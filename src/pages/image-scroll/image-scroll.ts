import { Component, ViewChild } from '@angular/core';
import { NavController, NavParams, Platform } from 'ionic-angular';
import { LazyMapsAPILoader } from 'angular2-google-maps/core/services';
import _ from "lodash";

import {
  CameraRollWithLoc, ImageService, localTimeAsDate, add$ImgAttrs,
  cameraRollPhoto,
  mediaType, optionsFilter
} from "../../shared/index";
import { moment } from "../moment/moment"

declare var google:any;

/*
  Generated class for the ImageScroll page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-image-scroll',
  templateUrl: 'image-scroll.html'
  , providers: [
    LazyMapsAPILoader
  ]
  , styles: [`
    .sebm-google-map-container {
      height: 240px;
      opacity: 0;
      transition: opacity 150ms ease-in;
    }
    @media only screen and (min-width: 500px) {
      .sebm-google-map-container {
         height: 480px;
       }
    }
  `],
})
export class ImageScrollPage {
  moments : moment[];
  mapAttrs: any;
  showMap: boolean = false;
  title : string;
  items : cameraRollPhoto[] = [];
  headerFn: (o,i,l)=>string;
  fitBounds: google.maps.LatLngBoundsLiteral;

  @ViewChild('sebmGoogleMapComponent') private sebmGoogMap: any;

  constructor(
    public navCtrl: NavController
    , public platform: Platform
    , public cameraRoll: CameraRollWithLoc
    , public imageService: ImageService
    , private navParams: NavParams
    , private googleMapsAPI: LazyMapsAPILoader
  ) {}

  ionViewDidLoad() {
    console.log('Hello ImageScrollPage Page');
  }

  ionViewDidEnter() {
    const cameraRoll = this.navParams.get('cameraRoll');
    if (cameraRoll) {
      this.items = cameraRoll;
      this.headerFn = this.navParams.get('headerFn')
      this.moments = this.navParams.get('moments');
      let mapBounds = new google.maps.LatLngBounds()
      _.each(this.moments, (m,i,l)=>{
        if (m.bounds instanceof google.maps.LatLngBounds) {
          mapBounds.union(m.bounds);
        } else if (_.isFunction(m.bounds['toJSON'])) {
          // HACK: somehow m.bounds NOT instanceof google.maps.LatLngBounds
          mapBounds.union( m.bounds['toJSON']() );
        }
        // console.log("add bounds", m.bounds.getCenter().toUrlValue());
      })
      this.mapAttrs = {
        bounds: mapBounds.toJSON(),
        center: mapBounds.getCenter() as google.maps.LatLng,
        zoom: 14
      }
      // console.log('mapAttrs=',this.mapAttrs);

      this.showMap = true;
      // console.log("isLatLngBounds=", this.mapAttrs.bounds instanceof google.maps.LatLngBounds)
      // console.log("map LatLng=",this.mapAttrs.center.toUrlValue())
      // console.log('loading cameraRoll from MomentPage, count=', this.items.length)
    } else {
      this.moments = []
      this.mapAttrs = null;
      this.showMap = false;
      this.headerFn = this.defaultHeaderFn;
      this.loadCameraRoll();
    }
    this.title = this.navParams.get('title') || null;
  }

  loadCameraRoll(){
    const LIMIT = 999;
    const queryOptions = {
      startDate: new Date('2016-01-01'),
      endDate: new Date('2016-12-31'),
    };
    this.platform.ready().then(
      () => {
        let pr = (this.items.length)
          ? Promise.resolve(this.items)
          : this.cameraRoll.queryPhotos(queryOptions)
        return pr
        .then( (photos)=>{
          console.log(`loadCameraRoll(), rows=${photos.length}`)
          let first = _.sample(this.cameraRoll.getPhotos(LIMIT));
          let firstDate = new Date(first.dateTaken);
          console.log('loadCameraRoll, from=', firstDate );
          this.items = this.cameraRoll.filterPhotos({
            startDate: firstDate,
            mediaType: [mediaType.Image]
          }).getPhotos(LIMIT);

          console.log(`loadCameraRoll(), items=${this.items.length}`)
          if (this.platform.is("cordova") == false) {
            console.warn("cordova not available");
            _.times( LIMIT-1 , i=>this.items.push(this.items[0]))
          }
        })
    })
  }

  defaultHeaderFn(record, recordIndex, records) : string {
    if (recordIndex % 5 === 0) {
      return `${recordIndex+1} - ${Math.min(recordIndex + 5, records.length)}`;
    }
    return null;
  }

  getLazySrc(photo: cameraRollPhoto) : cameraRollPhoto {
    if (!photo) return {} as cameraRollPhoto
    const photoW = 343;
    // console.info('ImageScrollPage.getLazySrc', photo.filename)
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
}
