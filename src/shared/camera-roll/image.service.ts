import { Injectable, Pipe, PipeTransform, } from '@angular/core';
import { Platform } from 'ionic-angular';
import { File, DirectoryEntry, Entry, FileError, RemoveResult} from 'ionic-native';
import _ from "lodash";

import {cameraRollPhoto} from './index';

declare var window;
declare var cordova;

// http://stackoverflow.com/questions/31548925/how-to-access-image-from-native-uri-assets-library-in-cordova-for-ios
// http://stackoverflow.com/questions/39866395/angular2-how-do-i-get-a-different-subclass-of-an-injectable-depending-on-the/39867713#39867713
const DEMO_SRC = "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQnF13DgaMHi5rmpKuCiHwID9u-msI9qSZsznjRnWv31LBUedCNqw";

/**
 * convert a cameraRollPhoto.localTime string to Date() in local timezone
 * e.g. cameraRollPhoto.localTime = "2014-10-24 04:45:04.000" => Date()
 */
export function localTimeAsDate(arg:string | {localTime: string}): Date {
  let localTime: string;
  if (typeof arg == "string") {
    localTime = arg;
  } else {
    localTime = arg.localTime;
  }
  try {
    const [,d,h,m,s] = localTime.match( /(.*)\s(\d*):(\d*):(\d*)\./)
    const dt = new Date(d);
    dt.setHours(parseInt(h), parseInt(m), parseInt(s));
    // console.log(`localTimeAsDate=${dt.toISOString()}`)
    return dt;
  } catch (err) {
    throw new Error(`Invalid localTime string, value=${localTime}`);
  }
}

/**
 * simple cache manager for cordova image files
 *  - keep track of UUIDs which have been copied to the `cordovaPath`
 *    for serving from `IMG.src`.
 *  - delete cached files when file count exceeds GARBAGE_COLLECT.max
 */
class FileCache {
  GARBAGE_COLLECT = {
    MAX: 10,
    MIN: 5
  };

  removeFn : (uuid:string) => void;
  
  private _cache: string[] = [];

  constructor(options: any = {}){
    this.settings(options);
  }

  settings(options: any = {}){
    let {max, min, removeFn} = options;
    if (max) this.GARBAGE_COLLECT.MAX = max
    if (min) this.GARBAGE_COLLECT.MIN = min
    if (removeFn) this.removeFn = removeFn;
  }

  isCached(uuid:string):boolean {
    const localIdentifier = uuid.slice(0,36);
    return this._cache.indexOf(localIdentifier) > -1;
  }

  cache(uuid:string) {
    const localIdentifier = uuid.slice(0,36);
    this._cache.unshift(localIdentifier);
    if (this._cache.length % 5 == 0) 
      this._cache = _.uniq(this._cache);
    if (this._cache.length > this.GARBAGE_COLLECT.MAX ){
      let remove = this._cache.splice(this.GARBAGE_COLLECT.MIN);
      if (this.removeFn){
        remove.forEach( localIdentifier=>this.removeFn(localIdentifier) );
      }
    }
  }
  
  clear(uuid:string){
    const localIdentifier = uuid.slice(0,36);
    this._cache = _.filter(this._cache, id=>id!=localIdentifier);
    if (this.removeFn) this.removeFn(localIdentifier);
  }

}

/**
 * factory function to create ImageService stub when platform is NOT cordova
 */
export function ImageServiceFactory (platform: Platform) : ImageService {
  if (platform.is("cordova"))
    return new CordovaImageService(platform)
  else
    return new ImageService(platform)
}


@Injectable()

/**
 * display a static image
 */
export class ImageService {
  protected _fileCache : FileCache;

  constructor(public platform: Platform){
    this._fileCache = new FileCache();
  }

  getSrc(arg:string | {uuid: string}) : Promise<string> {
    let localIdentifier: string;
    if (typeof arg == "string") {
      localIdentifier = arg;
    } else if (typeof arg == "object" && arg.uuid != undefined) {
      localIdentifier = arg["uuid"];
    } else  {
      console.error("Error: expecting uuid or {uuid: }");
      return;
    }
    // Hack: hard coded
    return Promise.resolve(DEMO_SRC);
  }

  getLazySrc( photo: cameraRollPhoto) : cameraRollPhoto {
    let localIdentifier = photo.uuid.slice(0,36);
    if (photo.hasOwnProperty('$src')) {
      if (this._fileCache.isCached(localIdentifier))
        return photo;
      console.log(`getLazySrc not cached, uuid=${localIdentifier}`);
    }
    // this.cache(localIdentifier);
    this._fileCache.cache(localIdentifier);
    Object.assign(photo, {'$src': ""});
    this.getSrc(photo).then(src=>{
      photo['$src'] = src;
    });
    console.log('lazySrc, uuid=', localIdentifier);
    return photo;
  }
}



/**
 * display image from device
 * - copies image from nativePath then resolves
 *   with path to src in to `cordova.file.cacheDirectory`
 * usage: CordovaImageService.getSrc(o).then( src=>add['$src']=src );
 *  - tested on iOS only
 */
export class CordovaImageService  extends ImageService {
  private _cacheRoot: {[key:string]:DirectoryEntry} = {};
  protected CACHE = {
    GC: 60,
    LIMIT: 50
  };

  constructor(public platform: Platform){
    super(platform);
    this._fileCache.settings({
      max: 60, 
      min:50,
      removeFn: (uuid:string)=>this.removeFile(uuid)
    });
  }

  private removeFile(localIdentifier:string) : void {
    const cordovaPath = cordova.file.cacheDirectory;
    const filename = `${localIdentifier}.jpg`;
    File.removeFile( cordovaPath, filename )
    .then(
      (result:RemoveResult)=>{
        if (result.success)
          console.log(`file removed, path=${result.fileRemoved.nativeURL}`)
        else
          console.log(`Error removing cached file, path=${result.fileRemoved.nativeURL}`)
      }
    )
  }

  /**
   * @param cordovaPath string
   * @param localIdentifier string, uuid
   * 
   * NOTE: cannot use File.copyFile() with nativePath=`assets-library:`
   *  File.copyFile(nativePath, nativeFile, cordovaPath, filename)
   *   .then( (destfe: any)=>{
   *     return destfe.nativeUrl;
   *   })
   */
  private copyFile(cordovaPath:string, localIdentifier: string) : Promise<Entry | Error> {
    const nativePath = `assets-library://asset/`
    const nativeFile = `asset.JPG?id=${localIdentifier}&ext=JPG`
    localIdentifier = localIdentifier.slice(0,36);  // using just uuid
    const filename = `${localIdentifier}.jpg`;

    return new Promise<Entry | Error>( (resolve, reject)=>{
      File.resolveLocalFilesystemUrl(nativePath + nativeFile)
      .then(
        srcfe=>{
          if (!srcfe.isFile) throw new Error("Entry Not A File");
          // get destpath
          let pr = this._cacheRoot[cordovaPath]
            ? Promise.resolve(this._cacheRoot[cordovaPath])
            : File.resolveDirectoryUrl(cordovaPath)
          pr.then(
            destpath=>{
              this._cacheRoot[cordovaPath] = destpath;    // cache DirectoryEntry
              srcfe.copyTo(
                destpath, filename
                , (destfe)=>{
                  console.log(`ImageService.copyFile(): filename=${filename}`);
                  resolve(destfe)
                }
                , (err)=>{
                  if (err.code==1)
                    console.error(`NOT_FOUND_ERR, path=${srcfe.nativeURL}`)
                  else
                    console.error(`Error copying file, path=${destpath.nativeURL}, file=${filename}`);
                  // console.error(err);
                  reject(err);
                }
              );
            }
          )
        }
      )
    });
  }

  getSrc(arg:string | {uuid: string}) : Promise<string | Error> {
    let localIdentifier: string;
    if (typeof arg == "string") {
      localIdentifier = arg;
    } else if (typeof arg == "object" && arg.uuid != undefined) {
      localIdentifier = arg["uuid"];
    } else  {
      console.error("Error: expecting uuid or {uuid: }");
      return;
    }

    // cordova only
    localIdentifier = localIdentifier.slice(0,36);  // using just uuid
    const nativePath = `assets-library://asset/`
    const nativeFile = `asset.JPG?id=${localIdentifier}&ext=JPG`
    const cordovaPath = cordova.file.cacheDirectory;
    const filename = `${localIdentifier}.jpg`;
    //    FAILs with uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3/L0/001"
    //    OK with    uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3"
    return File.checkFile(cordovaPath, filename)
    .then(  (isFile)=>{
      if (!isFile){
        // File.removeFile()?
        throw new Error("Not a file, is this a directory??");
      }
      return File.resolveLocalFilesystemUrl(cordovaPath + filename)
    })
    .catch( (err)=>{
      if (err.message=="NOT_FOUND_ERR")
        // copy file from iOS to cordova.file.cacheDirectory
        // NOTE: cannot use File.copyFile from src_path=`assets-library:`
        return this.copyFile(cordovaPath, localIdentifier)
        .catch( 
          (err)=>{
            // this.cache(localIdentifier);    
            this._fileCache.cache(localIdentifier);   // cache copyFile errors to avoid repeat
            console.error(`Error: File.copyFile(), err=${err}`);
            throw err;
          }
        )
      // for all other FileErrors:
      // update cache on File.copyFile() error  
      this._fileCache.clear(localIdentifier);
      console.log(`getSrc() Error, err=${JSON.stringify(err)}`); 
      throw err;
    })
    .then(
      (destfe:Entry)=>{
        console.log(`ImageService.getSrc(): uuid=${localIdentifier}, path=${destfe.nativeURL}`);
        return destfe.nativeURL;
      }
    )
  }
}


@Pipe({ name:"renderPhotoForView" })
export class renderPhotoForView implements PipeTransform {
  constructor( private imgSvc: ImageService ){
    console.warn("angular2 DatePipe is broken on safari, using manual format");
  }
  /**
   * convert a cameraRollPhoto.localTime string to Date() in local timezone
   * e.g. cameraRollPhoto.localTime = "2014-10-24 04:45:04.000" => Date()
   */

  transform(photos: cameraRollPhoto[]) : any[] {
    return photos.map(o=>{
      const add :any = { '$src': ""};
      if (o.localTime) {
        // BUG: safari does not parse ISO Date strings
        add['$localTime'] = localTimeAsDate(o.localTime);
        // console.warn(`>>> renderPhotoForView attrs=${JSON.stringify(add)}`);
        // add['$localTime'] = this.datePipe.transform( add['$localTime'], "medium");
        // TODO: use momentjs
        add['$localTime'] = add['$localTime'].toString().slice(0,24);
      }
      Object.assign(add, o);
      this.imgSvc.getSrc(o).then( src=>add['$src']=src );
      return add;
    })
  }
}
