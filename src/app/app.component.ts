import { Component } from '@angular/core';
import { LazyMapsAPILoader } from 'angular2-google-maps/core/services';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';
import ImgCache from 'imgcache.js';

import { TabsPage } from '../pages/tabs/tabs';


@Component({
  template: `<ion-nav [root]="rootPage"></ion-nav>`
})
export class MyApp {
  rootPage = TabsPage;

  constructor(
    public platform: Platform
    , private googleMapsAPI: LazyMapsAPILoader
  ) {
    this.googleMapsAPI.load().then( ()=>{
      console.info("googleMapsAPI loaded");
    })
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      StatusBar.styleDefault();
      Splashscreen.hide();
    })
    .then( ()=>{
      // imgCache.js
      // activated debug mode
      ImgCache.options.debug = true;
      // increase allocated space on Chrome to 50MB, default was 10MB
      ImgCache.options.chromeQuota = 50*1024*1024;
      // page is set until img cache has started
      ImgCache.init(()=>{ 
          ImgCache.ready = true
        },
        ()=>{ 
          console.error('ImgCache init: error! Check the log for errors');
        });      
    });
  }
}
