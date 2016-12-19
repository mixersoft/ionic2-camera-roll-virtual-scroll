import { Component, Pipe } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavController, Platform } from 'ionic-angular';
import { LazyMapsAPILoader } from 'angular2-google-maps/core/services';
import _ from "lodash";

import {
  CameraRollWithLoc, ImageService, localTimeAsDate, add$ImgAttrs,
  cameraRollPhoto,
  mediaType, optionsFilter
} from "../../shared/index";
import { ImageScrollPage } from "../image-scroll/image-scroll"

declare var google: any;

/**
 * collapse momentIds
 */
export interface moment {
  uuid: string
  bounds: google.maps.LatLngBounds
  label: string
  coverId: string,
  coverPhoto: cameraRollPhoto
  bgSrc: string
  from: Date
  to: Date
  count: number
  cameraRoll: Array<cameraRollPhoto | burstPhoto>
}

/**
 * collapse burstIds
 */
interface burstPhoto {
  uuid: string
  cover: number
  photos: cameraRollPhoto[]
}

function parseMomentsByLocation(moments: moment[]): {[key:string]:any} {
  // index by cameraRollPhoto.momentLocationName
  return _.reduce(moments, (memo, m,k,l)=>{
    // m.cameraRoll = []
    let loc = memo[m.label];
    if (!loc) {
      loc = {
        label: m.label,
        count: 1,
        from: m.from,
        moments: [m]
      }
      memo[m.label] = loc
    } else {
      loc.moments.push(m);
      loc.count = loc.moments.length;
      if (m.from > loc.from) loc.from = m.from; // use mostRecent from date
    }
    return memo
  }, {} as {[key:string]: any} )
}

function parseCameraRollForMoments(photos: cameraRollPhoto[]) : any {
  let result = _.chain(photos)
  .sortBy(o=>o['dateTaken'])
  // reduce: index by cameraRollPhoto.momentId
  .reduce( (byMomentIds, o,i,l)=>{
    if (!o.location) return byMomentIds
    const localTime = o.localTime instanceof Date ? o.localTime : localTimeAsDate(o.localTime);
    const latlng = o.location.toLatLng();
    if (o.momentId) {
      let moment: moment = byMomentIds[o.momentId];
      if (!moment) {
        // new
        moment =  {
          uuid: o.momentId,
          bounds: new google.maps.LatLngBounds(latlng),
          // bounds: new google.maps.LatLngBounds(o.position as any as google.maps.LatLng),
          label: o.momentLocationName,
          coverId: o['isFavorite'] && o.mediaType==mediaType.Image ? o.uuid : null,
          coverPhoto: o['isFavorite'] && o.mediaType==mediaType.Image ? o : null,
          bgSrc: o['$img'] && o['$img'].src || null,
          from: localTime,
          to: localTime,
          count: 1,
          cameraRoll: [o]
        }
        byMomentIds[o.momentId] = moment;
      } else {
        // append
        moment.cameraRoll.push(o);
        moment.count = moment.cameraRoll.length;
        // moment.bounds.extend(o.position as any as google.maps.LatLng);
        moment.bounds.extend(latlng)
        if (localTime < moment.from) moment.from = localTime;
        if (localTime > moment.to) moment.to = localTime;
        if (!moment.coverId && o['isFavorite'] && o.mediaType==mediaType.Image) {
          moment.coverId = o.uuid;
          moment.coverPhoto = o;
        }
      }
    } else { 
      // byMomentIds[o.uuid] = o;
      throw new Error("cameraRoll.momentId is null")
    }
    return byMomentIds
  }, {} as {[key:string]:moment})
  .forEach( (v:any,k,l)=>{
    
    const m: moment = v;
    const uuid: string = k as any;

    // reduce m.cameraRoll to Array<cameraRollPhoto | burstPhoto>
    let burstPhotos : { [key: string]: burstPhoto } = {};
    m.cameraRoll = _.reduce( m.cameraRoll, (memo, o,i,l)=>{
      let p = o as cameraRollPhoto;
      if (p['burstId']) {
        let burst: burstPhoto = burstPhotos[p['burstId']];
        if (!burst) {
          burst = {
            uuid: p['burstId'],
            cover: 0,
            photos: [p]
          }
          burstPhotos[p['burstId']] = burst
          memo.push(burst)
        } else {
          burst.photos.push(p);
          if (o['representsBurst']) burst.cover = i;
        }
      } else
        memo.push(p)
      return memo
    }, [])
    // replace burstPhoto.photos.length==1 with photo
    _.each(burstPhotos, (v,i,l)=>{
      if (v.photos.length == 1){
        const swapAt = _.findIndex(m.cameraRoll, v);
        const swapped = m.cameraRoll.splice(swapAt,1,v.photos[0]);
        // console.log('swapped', swapped);
      }
    });

    // patch moment.coverId if null
    if (!m.coverId){
      // find the first image
      let coverPhoto = _.find( m.cameraRoll, (o)=>{
        const p : cameraRollPhoto = o['photos'] 
          ? (<burstPhoto>o).photos[(<burstPhoto>o).cover]
          : o as cameraRollPhoto
        return (p.mediaType == mediaType.Image)
      })
      if (!coverPhoto) {
        // take the first cameraRollPhoto, regardless of type
        coverPhoto = m.cameraRoll[0]
      }
      // dereference burstPhoto, if necessary
      coverPhoto = !coverPhoto['photos'] 
        ? (<cameraRollPhoto>coverPhoto)
        : (<burstPhoto>coverPhoto).photos[(<burstPhoto>coverPhoto).cover]
      m.coverPhoto = coverPhoto as cameraRollPhoto;
      m.coverId = coverPhoto.uuid;
    }
  })
  .value();
  return result as any as moment[];
}

/*
  Generated class for the Moment page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-moment',
  templateUrl: 'moment.html'
  , providers: [
    DatePipe,
    LazyMapsAPILoader
  ]
})
export class MomentPage {
  moments : moment[] = [];
  momentsByLocation: {[key:string]:any} = {}
  peek: any = [];
  selectedCameraRoll: cameraRollPhoto[];
  selectedMomentLoc: any;

  constructor(
    public navCtrl: NavController
    , public platform: Platform
    , public cameraRoll: CameraRollWithLoc
    , public imageService: ImageService
    , public datePipe: DatePipe
    , private googleMapsAPI: LazyMapsAPILoader
  ) {
  }

  ionViewDidLoad() {
    console.log('Hello MomentPage Page');
  }

  ionViewDidEnter() {
    if (_.isEmpty(this.peek)) {
      this.getMoments()
    }
  }


  getMoments(options = {}){
    let promises: Promise<any>[] = [];
    promises.push( this.platform.ready().then( 
      ()=>{ 
        this.cameraRoll.queryPhotos(options);
      }) 
    );
    promises.push( this.googleMapsAPI.load() );
    return Promise.all(promises)
    .then( ()=>{
      let photos = this.cameraRoll.getPhotos(9999);
      if (photos.length) {
        // make sure google.maps API is loaded
        this.moments = parseCameraRollForMoments(photos);
        this.momentsByLocation = parseMomentsByLocation(this.moments);
        this.peek = this.sampleMomentsByLocation(this.moments, 24) 
      } else {
        console.warn("NO PHOTOS FOUND")
      }
    })
  }

  sampleMomentsByLocation(moments:moment[], size:number = 24, method: string = "AtLeast5"){
    const atLeastNPhotos :( (n:number) => (m:any)=>boolean ) = (n:number)=>{
      let count = n;
      return (m)=>{
        const photoCount = _.reduce(m['moments'], (memo, o: moment)=>{
          return memo += o.cameraRoll.length;
        }, 0)
        return photoCount >= count;
      }
    }

    let filterMethod:(m:{
        label: string,
        count: number,
        from: Date,
        moments: moment[]
      })=>boolean;

    switch (method) {
      case "hello":
      case "AtLeast5":
      default: 
        filterMethod = atLeastNPhotos(5)
    }

    const samples = _.chain(this.momentsByLocation)
      .values()
      .filter(
        // sample from momentsLocs with > 5 photos
        (m)=> filterMethod
      )
      .sampleSize( size )
      .each( m=>{
        m['$coverPhoto'] = m['$coverPhoto']  || this.getCoverPhoto(m);
      })
      .sortBy( o=>o['from'] )  // ASC momentLoc.from
      .reverse()  // DESC momentLoc.from
      .value();
    console.log('sampleMomentsByLocation, first=', samples[0])
    return samples;

  }

  getCoverPhoto(arg0: moment | any ): cameraRollPhoto{
    let m: moment;
    if (arg0.hasOwnProperty('cameraRoll')) m = arg0 as moment;
    else m = _.sample(arg0.moments) as moment;
    const found = _.find(m.cameraRoll, (o:any)=>{
      let p: cameraRollPhoto;
      if (o.hasOwnProperty('photos')) {
        p = (<burstPhoto>o).photos[ (<burstPhoto>o).cover ]
      } else {
        p = o
      }
      return p.uuid == m.coverId;
    })
    if (!found) throw new Error('moment.coverId NOT FOUND')
    return found as cameraRollPhoto
  }

  getLazySrc(photo: cameraRollPhoto) : cameraRollPhoto {
    if (!photo) return {} as cameraRollPhoto
    const photoW = 343;
    /**
     * IMPORTANT:  FileCache.cache() garbage collection
     * can cause view render error if:
     *    this.peek.length > GARBAGE_COLLECT.min
     */
    // console.info('MomentPage.getLazySrc', photo.filename)
    return this.imageService.getLazySrc(photo, photoW)
  }
  getLocalTime(photo: cameraRollPhoto) : string {
    if (!photo) return null
    if (typeof photo.localTime == "string")
      photo.localTime = localTimeAsDate(photo.localTime)
    // TODO: use momentjs
    return photo.localTime.toString().slice(0,24)
  }
  getDimensions(photo:cameraRollPhoto, key:string) : string {
    let o = key ? photo[key] : photo;
    if (key) return `${Math.round(o.w)}x${Math.round(o.h)}px`;
    return `${Math.round(o.width)}x${Math.round(o.height)}px`;
  }

  getSubtitle(momentLoc): string {
    let m: moment;
    let count = {
      moments: momentLoc.moments.length,
      photos: 0
    }
    _.each(momentLoc.moments, (m,i,l)=>{
      count.photos += m.cameraRoll.length;
    })
    const result = [];
    if (count.moments > 1) {
      result.push( count.moments );
      result.push( "moments");
    }
    if (count.photos) {
      result.push( count.photos );
      result.push( count.photos>1 ? "photos" : "photo");
    }
    return result.join(' ')
  }


  sampleMomentLoc() {
    // get a random momentLoc, 
    // called by shake() from ImageScrollPage
    const momentLocs = _.sampleSize(this.peek, 2)
    let m = momentLocs.shift()
    if (m != this.selectedMomentLoc)
      this.selectedMomentLoc = m;
    else {
      this.selectedMomentLoc = momentLocs.shift();
    }
    return this.selectedMomentLoc;
  }

  showMomentRoll(momentLoc:any){

    const daysBetween = function( date1, date2 ) {
      //Get 1 day in milliseconds
      var one_day=1000*60*60*24;

      date1 = new Date(date1)
      date1.setHours(0,0,0,0);
      date2 = new Date(date2)
      date2.setHours(0,0,0,0);
    
      // Convert both dates to milliseconds
      var date1_ms = date1.getTime();
      var date2_ms = date2.getTime();

      // Calculate the difference in milliseconds
      var difference_ms = date2_ms - date1_ms;
        
      // Convert back to days and return
      return Math.round(difference_ms/one_day); 
    }

    this.selectedMomentLoc = momentLoc;

    // flatten momentLoc.moments into single array, with headerFn data
    const headerLookup : {[key : number]: moment} = {};
    const momentLocCameraRollPhotos = _.reduce( momentLoc.moments, (memo, o:moment,i,l)=>{
      headerLookup[memo.length] = o
      const cameraRollPhotos = _.map(o.cameraRoll, (o,i,l)=>{
        let p: cameraRollPhoto;
        if (o.hasOwnProperty('photos')) {
          p = (<burstPhoto>o).photos[ (<burstPhoto>o).cover ]
        } else {
          p = o as cameraRollPhoto
        }
        return p;
      })
      memo = memo.concat(cameraRollPhotos)
      return memo
    }, [])

    this.navCtrl.push(ImageScrollPage, {
      'moments': momentLoc.moments,
      'title': momentLoc.label,
      'cameraRoll': momentLocCameraRollPhotos,
      'headerFn': (o,i,l):string=>{
        // headerLookup included as closure
        if (!headerLookup[i]) return null;

        let {from, to, count} = headerLookup[i];
        // use momentjs
        let dateRangeStr = from.toDateString();
        const daysBtw = daysBetween(from, to);
        if (daysBtw > 0)  dateRangeStr += ` ${daysBtw + 1} days`
        dateRangeStr = `${dateRangeStr} ${count} photo` + (count>1 ? 's' : '');
        const momentCounter = `(${ _.keys(headerLookup).indexOf(i+'')+1 }/${momentLoc.moments.length}) moments`;
        return  `${dateRangeStr}   ${momentCounter}`;
      }
    })
    return;
    // const momentIndex = 0
    // let cameraRoll = (<moment>momentLoc.moments[momentIndex]).cameraRoll;
    // cameraRoll = _.map(cameraRoll, (o,i,l)=>{
    //   let p: cameraRollPhoto;
    //   if (o.hasOwnProperty('photos')) {
    //     p = (<burstPhoto>o).photos[ (<burstPhoto>o).cover ]
    //   } else {
    //     p = o as cameraRollPhoto
    //   }
    //   return p;
    // })
    // this.navCtrl.push(ImageScrollPage, {cameraRoll})
  }

  togglePhotos(momentLoc){
    
    if (this['$peek']) {
      this.peek = this['$peek'];
      this.selectedCameraRoll = null;
      this['$peek'] = null;
    } else {
      this['$peek'] = this.peek;
      this.peek = [momentLoc]

      let cameraRoll = (<moment>momentLoc.moments[0]).cameraRoll;
      this.selectedCameraRoll = _.map(cameraRoll, (o,i,l)=>{
        let p: cameraRollPhoto;
        if (o.hasOwnProperty('photos')) {
          p = (<burstPhoto>o).photos[ (<burstPhoto>o).cover ]
        } else {
          p = o as cameraRollPhoto
        }
        return p;
      })
    }
  }

}
