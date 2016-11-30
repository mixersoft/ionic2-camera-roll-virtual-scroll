import { Injectable, Pipe, PipeTransform, } from '@angular/core';
import { Platform } from 'ionic-angular';
import { File } from 'ionic-native';
import _ from "lodash";

import {cameraRollPhoto} from './index';

declare var window;
declare var cordova;

// http://stackoverflow.com/questions/31548925/how-to-access-image-from-native-uri-assets-library-in-cordova-for-ios
// http://stackoverflow.com/questions/39866395/angular2-how-do-i-get-a-different-subclass-of-an-injectable-depending-on-the/39867713#39867713
const DEMO_SRC = "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQnF13DgaMHi5rmpKuCiHwID9u-msI9qSZsznjRnWv31LBUedCNqw";



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
  protected _cache = [];
  protected CACHE = {
    GC: 10,
    LIMIT: 5
  };

  constructor(public platform: Platform){}

  protected cache(uuid:string) {
    let localIdentifier = uuid.slice(0,36);
    this._cache.unshift(localIdentifier);
    if (this._cache.length % 5 == 0) 
      this._cache = _.uniq(this._cache);
    if (this._cache.length > this.CACHE.GC ){
      let remove = this._cache.splice(this.CACHE.LIMIT);
    }
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
      if (this._cache.indexOf(localIdentifier) > -1)
        return photo;
    }
    this.cache(localIdentifier);
    Object.assign(photo, {'$src': ""});
    this.getSrc(photo).then(src=>{
      photo['$src'] = src;
    });
    console.log('lazySrc, uuid=', photo.uuid);
    return photo;
  }

  /**
   * convert a cameraRollPhoto.localTime string to Date() in local timezone
   * e.g. cameraRollPhoto.localTime = "2014-10-24 04:45:04.000" => Date()
   */
  localTimeAsDate(arg:string | {localTime: string}): Date {
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

}



/**
 * display image from device
 * - copies image from nativePath then resolves
 *   with path to src in to `cordova.file.cacheDirectory`
 * usage: CordovaImageService.getSrc(o).then( src=>add['$src']=src );
 *  - tested on iOS only
 */
export class CordovaImageService  extends ImageService {
  protected CACHE = {
    GC: 60,
    LIMIT: 50
  };

  constructor(public platform: Platform){
    super(platform);
  }

  protected cache(uuid:string) {
    let localIdentifier = uuid.slice(0,36);
    this._cache.unshift(localIdentifier);
    if (this._cache.length % 5 == 0) 
      this._cache = _.uniq(this._cache);
    if (this._cache.length > this.CACHE.GC ){
      // FIFO: remove old files
      let remove = this._cache.splice(this.CACHE.LIMIT);
      remove.forEach( localIdentifier=>{
        this.removeFile(localIdentifier);
      });
    }
  }

  private removeFile(localIdentifier:string) : void {
    const cordovaPath = cordova.file.cacheDirectory;
    const filename = `${localIdentifier}.jpg`;
    window.resolveLocalFileSystemURL(
      cordovaPath + filename
      , (srce: any) => {
        if (srce.isFile){
          let path = srce.nativeURL;
          srce.remove(
            ()=>console.log(`file removed, ${path}`)
            , (err)=>console.log(`ERROR: file remove, ${err.code}`)
          );
        }
      });
  }

  // cordova only
  private copyFile(localIdentifier: string) : Promise<any> {
    const nativePath = `assets-library://asset/`
    const nativeFile = `asset.JPG?id=${localIdentifier}&ext=JPG`
    const cordovaPath = cordova.file.cacheDirectory;
    const filename = `${localIdentifier}.jpg`;

    // same as:
    // File.copyFile(nativePath, nativeFile, cordovaPath, filename)
    // .then( (fse: any)=>{
    //   return fse.nativeUrl;
    // })
    const pr = new Promise<any>( (resolve, reject)=>{
      window.resolveLocalFileSystemURL(
        nativePath + nativeFile
        , (srce: any) => {
          if (!srce.isFile)
            return reject("File not found");
          // return resolve( srce.nativeURL );
          return resolve(srce);
        });
    }).then((srce: any)=>{
      return new Promise<any>( (resolve, reject)=>{
        window.resolveLocalFileSystemURL(
          cordovaPath
          , (destfe) => {
            srce.copyTo(destfe, filename
              , (copyfe)=>{
                console.log(`ImageService.copyFile(): filename=${filename}`);
                resolve(copyfe)
              }
              , (err)=>{
                console.error(`Error copying file, dest=${destfe.nativeURL}, file=${filename}`)
                reject(err);
              });
          });
      });
    });
    return pr;
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

    // cordova only
    const cordovaPath = cordova.file.cacheDirectory;
    // TODO: cordova.file.copy() does resolve the complete PHAsset.localIdentifier
    //    FAILs with uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3/L0/001"
    //    OK with    uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3"
    localIdentifier = localIdentifier.slice(0,36);  // using just uuid

    const filename = `${localIdentifier}.jpg`;
    const pr = new Promise<string>( (resolve, reject)=>{
      File.checkFile(cordovaPath, filename)
      .then(  (isFile)=>{
        if (!isFile)
          return reject("Not a file, is this a directory??");

        // File.checkFile(path, filename) : Promise<boolean>, should be Promise<fse>
        window.resolveLocalFileSystemURL(
          cordovaPath + filename
          , fse => resolve( fse.nativeURL )
          , err => reject(err)
        );
      })
      .catch( (err)=>{
        if (err.message=="NOT_FOUND_ERR")
          // copy file from iOS to cordova.file.cacheDirectory
          return this.copyFile(localIdentifier).then( fse => resolve( fse.nativeURL ) )
        return Promise.reject(err);
      })
      .catch( err=>{
        this._cache = _.filter(this._cache, id=>id!=localIdentifier);
        console.log(err)
        return reject(err);
      });
    });
    return pr
    .then( path=>{
      // this.cache(localIdentifier);
      // console.log(`ImageService.getSrc(): uuid=${localIdentifier}, path=${path}`);
      return path;
    });
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
  localTimeAsDate(localTime:string): Date {
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
  transform(photos: cameraRollPhoto[]) : any[] {
    return photos.map(o=>{
      const add :any = { '$src': ""};
      if (o.localTime) {
        // BUG: safari does not parse ISO Date strings
        add['$localTime'] = this.localTimeAsDate(o.localTime);
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