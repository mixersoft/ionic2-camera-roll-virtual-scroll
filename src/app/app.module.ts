import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler, Platform } from 'ionic-angular';
import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';
import { MapPage } from '../pages/map/map';

import { SharedModule } from '../shared/shared.module';
import { AgmCoreModule } from 'angular2-google-maps/core';
import {
  CameraRollWithLocFactory, CameraRollWithLoc, MockCameraRollWithLoc,
  ImageServiceFactory, ImageService, CordovaImageService, renderPhotoForView
} from "../shared/camera-roll/index";

@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ContactPage,
    HomePage,
    TabsPage
    , MapPage
    // pipes
    , renderPhotoForView
  ],
  imports: [
    IonicModule.forRoot(MyApp)
    , SharedModule.forRoot()
    , AgmCoreModule.forRoot({
      apiKey: null      // add your google.maps API Key here
      ,libraries: []    // add extra google.maps libs here
    }),
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    AboutPage,
    ContactPage,
    HomePage,
    TabsPage
    , MapPage
  ],
  providers: [
    {provide: ErrorHandler, useClass: IonicErrorHandler}
    , {
      provide: ImageService
      , deps: [Platform]
      , useFactory: ImageServiceFactory
    },
    , {
      provide: CameraRollWithLoc
      , deps: [Platform]
      , useFactory: CameraRollWithLocFactory
    }
  ]
})
export class AppModule {}
