import { Injectable, Pipe, PipeTransform, } from '@angular/core';
import ImgCache from 'imgcache.js';
import { Platform } from 'ionic-angular';
import { File, DirectoryEntry, Entry, FileError, RemoveResult} from 'ionic-native';
import _ from "lodash";


import { cameraRollPhoto, localTimeAsDate} from './index';

declare var window;
declare var cordova;

/**
 * NOTE: WkWebView delivers much better performance in cordova, 
 * but it currently has no access to fileURIs, so dataURIs are 
 * required. set in base class constructor
 */
let USE_DATA_URI = false;   

// http://stackoverflow.com/questions/31548925/how-to-access-image-from-native-uri-assets-library-in-cordova-for-ios
// http://stackoverflow.com/questions/39866395/angular2-how-do-i-get-a-different-subclass-of-an-injectable-depending-on-the/39867713#39867713
const DEMO_SRC = "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQnF13DgaMHi5rmpKuCiHwID9u-msI9qSZsznjRnWv31LBUedCNqw";

/**
 * simple cache manager for cordova image files
 *  - keep track of UUIDs which have been copied to the `cordovaPath`
 *    for serving from `IMG.src`.
 *  - delete cached files when file count exceeds GARBAGE_COLLECT.max
 */
class FileCache {
  GARBAGE_COLLECT = {
    MAX: 32,
    MIN: 12
  };
  removeFn : (uuid:string) => void;
  private _cache: string[] = []; // log cache requests, LIFO
  private _data: {[key:string]: string}  = {}  //  { uuid: dataURI or fileURI } 

  constructor(options: any = {}){
    this.settings(options);
  }

  settings(options: any = {}){
    let {max, min, removeFn} = options;
    if (max) this.GARBAGE_COLLECT.MAX = max
    if (min) this.GARBAGE_COLLECT.MIN = min
    if (!(removeFn == undefined)) this.removeFn = removeFn;
  }

  isCached(uuid:string):boolean {
    const localIdentifier = uuid.slice(0,36);
    return this._cache.indexOf(localIdentifier) > -1;
  }

  cache(uuid:string, value?: string) : string {
    const localIdentifier = uuid.slice(0,36);
    if (value) {
      this._data[localIdentifier] = value;
      console.log("FileCache._data keys, count=", _.keys(this._data).length);
    }

    const found = this._cache.indexOf(localIdentifier);
    if (found > 0) this._cache.splice(found,1);
    if (found != 0) this._cache.unshift(localIdentifier);
    if (this._cache.length > this.GARBAGE_COLLECT.MAX ){
      setTimeout( ()=>{
        let remove = this._cache.splice(this.GARBAGE_COLLECT.MIN);
        remove.forEach( localIdentifier=>{
          delete this._data[localIdentifier];  // dataURI or fileURI
          if (this.removeFn) this.removeFn(localIdentifier);
        });
      });
    }

    return this._data[localIdentifier] || null;
    
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
  if (platform.is("cordova")) {
    return new CordovaImageService(platform)
  } else
    return new ImageService(platform)
}






@Injectable()
/**
 * display a static image
 */
export class ImageService {
  protected _fileCache : FileCache;

  constructor(public platform: Platform){
    this.platform['$isWKWebView'] = !!window.indexedDB
    if (this.platform['$isWKWebView']) {
      USE_DATA_URI = true;
    }
    this._fileCache = new FileCache({
      max: 24, 
      min: 12,
    });
  }

  /**
   * use ImgCache to save hhtp URI to cache
   * WARNING: DOES NOT SUPPORT `assets-library:` native urls
   */
  getURIFromImgCache(src: string){
    if (!ImgCache.ready) {
      console.warn("ImageCache not READY");
      return Promise.reject(src);
    }
    if (src.indexOf('assets-library:') === 0) {
      console.warn("ImageCache does NOT support iOS nativeURLs");
      return Promise.reject(src);
    }
    return new Promise<string>( (resolve, reject)=>{
      ImgCache.isCached(src, (path:string, success: boolean)=>{
        if (success){
          ImgCache.getCachedFileURL(src
          , (src:string, cachedSrc:string)=>{
            resolve(cachedSrc);
          })
          , (src:string)=>{
            console.warn("ERROR: getCachedFileURL(), src=", src)
            reject(src);
          }
        } else {
          ImgCache.cacheFile(src
          , (cachedSrc:string)=>{
            console.log(`ImgCache.getCurrentSize=${ImgCache.getCurrentSize()}`);
            resolve(cachedSrc);
          }
          , (error)=>{
            console.warn("ERROR: cacheFile(), src=", src);
            reject(src)
          });
        }
      })
    });
  }

  getSrc(arg:string | {uuid: string}, dim?: {w:number, h:number}) : Promise<string> {
    let localIdentifier: string;
    if (typeof arg == "string") {
      localIdentifier = arg;
    } else if (typeof arg == "object" && arg.uuid != undefined) {
      localIdentifier = arg["uuid"];
    } else  {
      console.error("Error: expecting uuid or {uuid: }");
      return;
    }
    
    return Promise.resolve(DEMO_SRC)
    // .then( ()=>{
    //   return this.getURIFromImgCache(localIdentifier)
    //   .catch( (src)=>{
    //     // Hack: hard coded
    //     return Promise.resolve(DEMO_SRC);
    //   })
    // })
    .then(  src=>{
      return this._fileCache.cache(localIdentifier, src)
    })
  }

  getLazySrc( photo: cameraRollPhoto, imgW?: number, imgH?: number) : cameraRollPhoto {
    const start = Date.now();
    let localIdentifier = photo.uuid.slice(0,36);
    let $img = photo['$img'];
    let imgDim = {
        'w': (imgW || ($img && $img.w) || photo.width) as number,
        'h': (imgH || ($img && $img.h) || photo.height) as number
    };
    if (imgW){
      imgDim['h'] = photo.height/photo.width * imgW
    } else if (imgH) {
      imgDim['w'] = photo.width/photo.height * imgH;
    }

    let src: string = this._fileCache.cache(localIdentifier);  // fileURI or dataURI
    if (src){
      // file is cached and ready to go
      if (!$img) photo['$img'] = {} 
      Object.assign(photo['$img'], imgDim, src);
      console.log(`getLazySrc FROM cache, file=${photo.filename}, ms=${Date.now()-start}`);
      return photo;
    }

    if (photo['$img'] && this._fileCache.isCached(localIdentifier)) {
      // waiting for getSrc() completion
      Object.assign(photo['$img'], imgDim);   // update dimensions
      return photo;
    } else {
      // request to cache item
      photo['$img'] = Object.assign({ 'src': "" }, imgDim);
      this._fileCache.cache(localIdentifier);
      this.getSrc(photo, imgDim).then( (src)=>{
        photo['$img']['src'] = src;
        if (src)
          console.log(`getLazySrc CACHED, file=${photo.filename}, ms=${Date.now()-start}`);
        else
          throw new Error("getSrc() returned an empty value")
      })
      .catch( err=>console.error(err) );
    }
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
  private _cacheRoot: {[key:string]:DirectoryEntry} = {}; // folders for cached files

  constructor(public platform: Platform){
    super(platform);
    const fileCacheOptions = {}
    if (USE_DATA_URI) {
      // using FileCache with dataURIs
      // plugin.getImage() with 320px images
      // increase FileCache limits
      Object.assign(fileCacheOptions, {
        max: 400, 
        min: 300,
      })
    } else {
      // using FileCache with fileURIs
      // fullres images from cameraRoll
      Object.assign(fileCacheOptions, {
        max: 100, 
        min: 50,
        removeFn: (uuid:string)=>this.removeFile(uuid)
      })
    }
    this._fileCache.settings(fileCacheOptions);
  }

  /**
   * remove image files cached in cordova app folder  
   */
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
                  // console.log(`ImageService.copyFile(): filename=${filename}`);
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

  getSrc(arg:string | {uuid: string}, dim?: {w:number, h:number}) : Promise<string | Error> {
    let localIdentifier: string;
    if (typeof arg == "string") {
      localIdentifier = arg;
    } else if (typeof arg == "object" && arg.uuid != undefined) {
      localIdentifier = arg["uuid"];
    } else  {
      console.error("Error: expecting uuid or {uuid: }");
      return;
    }

    // check FileCache
    let src = this._fileCache.cache(localIdentifier);
    if (src) return Promise.resolve(src);

    // PHImageManager.requestImage() in iOS
    if (USE_DATA_URI){
      const plugin : any = _.get( window, "cordova.plugins.CameraRollLocation");
      if (plugin && plugin['getImage']){
        return new Promise<string>( (resolve, reject)=>{
            const options = {
              width: dim && dim.w || 320, 
              height: dim && dim.h || 240,
              rawDataURI: false 
            }
            plugin['getImage']([localIdentifier], options
            , (result)=>{
              // _.each(result, (dataURI,k,l)=>{
              //   this._fileCache.cache(localIdentifier, dataURI);
              // })
              // const dataURI = this._fileCache.cache(localIdentifier);
              const dataURI = result[localIdentifier];
              resolve(dataURI);
            }
            , (err)=>reject(err)
          )
        })
      }
    } else {   
      // use fileURI
      localIdentifier = localIdentifier.slice(0,36);  // using just uuid
      const nativePath = `assets-library://asset/`
      const nativeFile = `asset.JPG?id=${localIdentifier}&ext=JPG`
      const cordovaPath = cordova.file.cacheDirectory;
      const filename = `${localIdentifier}.jpg`;
      //    FAILs with uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3/L0/001"
      //    OK with    uuid="0A929779-BFA0-4C1C-877C-28F353BB0EB3"

      return Promise.resolve()
      // .then( ()=>{
      //   // using imgcache.js:  DOES NOT SUPPORT `assets-library:` native urls
      //   return this.getFromImgCache(nativePath + nativeFile)
      //   .catch( (src)=>{
      //     console.warn("recover: using File.checkFile() instead")
      //   })
      // })
      .then( ()=>{
        return File.checkFile(cordovaPath, filename)
      }).then(  (isFile)=>{
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
          // console.log(`ImageService.getSrc(): uuid=${localIdentifier}, path=${destfe.nativeURL}`);
          return destfe.nativeURL;
        }
      )
    }
  }
}


@Pipe({ name:"add$ImgAttrs" })
export class add$ImgAttrs implements PipeTransform {
  constructor( private imgSvc: ImageService ){
  }
  transform(photos: cameraRollPhoto[], imgW?: number, imgH?: number) : any[] {
    return photos.map(photo=>{
      return this.imgSvc.getLazySrc(photo, imgW, imgH)
    })
  }
}
