import { NgModule, ErrorHandler } from '@angular/core';
import { IonicApp, IonicModule, IonicErrorHandler, Platform } from 'ionic-angular';
import { LazyMapsAPILoader } from 'angular2-google-maps/core/services';

import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';
import { MapPage } from '../pages/map/map';
import { ImageScrollPage } from '../pages/image-scroll/image-scroll';
import { MomentPage } from '../pages/moment/moment';
import { PrettyPrintPipe } from '../pipes/pretty-print';

import { SharedModule } from '../shared/shared.module';
import { AgmCoreModule } from 'angular2-google-maps/core';
import {
  CameraRollWithLocFactory, CameraRollWithLoc, MockCameraRollWithLoc,
  ImageServiceFactory, ImageService, CordovaImageService, add$ImgAttrs
} from "../shared/camera-roll/index";

@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ContactPage,
    HomePage,
    TabsPage
    , MapPage
    , ImageScrollPage
    , MomentPage
    // pipes
    , add$ImgAttrs
    , PrettyPrintPipe
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
    , ImageScrollPage
    , MomentPage
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
    , LazyMapsAPILoader
  ]
})
export class AppModule {}
