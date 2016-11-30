import { Component } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';
import _ from "lodash";

import {
  CameraRollWithLoc, ImageService, renderPhotoForView,
  cameraRollPhoto,
  mediaType, optionsFilter
} from "../../shared/index";

declare var google:any;

/*
  Generated class for the ImageScroll page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-image-scroll',
  templateUrl: 'image-scroll.html'
})
export class ImageScrollPage {
  items : cameraRollPhoto[] = [];
  photoSrcPipe : renderPhotoForView;

  constructor(
    public navCtrl: NavController
    , public platform: Platform
    , public cameraRoll: CameraRollWithLoc
    , public imageService: ImageService
  ) {
    this.photoSrcPipe = new renderPhotoForView(this.imageService);
  }

  ionViewDidLoad() {
    console.log('Hello ImageScrollPage Page');
  }

  ionViewDidEnter() {
    this.loadCameraRoll();
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

  myHeaderFn(record, recordIndex, records) {
    if (recordIndex % 5 === 0) {
      return `${recordIndex+1} - ${Math.min(recordIndex + 5, records.length)}`;
    }
    return null;
  }

  getLazySrc(photo: cameraRollPhoto) : cameraRollPhoto {
    if (!photo) return {} as cameraRollPhoto
    const photoW = 343;
    const dim = photo['$dim'] || {w:640, h:480}

    if (dim) {
      photo['$w'] = photoW;
      photo['$h'] = dim.h/dim.w * photo['$w'];
    }
    
    return this.imageService.getLazySrc(photo)
  }
  getLocalTime(photo: cameraRollPhoto) : string {
    if (!photo) return null
    return this.imageService.localTimeAsDate(photo).toString().slice(0,24)
  }
}
