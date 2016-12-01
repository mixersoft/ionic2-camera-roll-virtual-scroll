# ionic2-virtual-scroll
Sample project to scroll through iOS camera-roll using `ionic2` component [virtual-scroll](http://ionicframework.com/docs/v2/api/components/virtual-scroll/VirtualScroll/). 
Notes:
* uses `<ion-img>` to lazyload image requests.
* uses `ImageService.getLazySrc()` to copy image files from `assets-library://asset/` to `cordova.file.cacheDirectory` for access by `IMG[src]`
* uses simple FIFO image cache/GC to limit the number of image files in cached in `cordova.file.cacheDirectory`
* NOT tested with WKWebView. see possible issues: 
  * [CORS issues](https://gist.github.com/mlynch/c63205f114def01ed0b9)
  * [loading local image files](https://forum.ionicframework.com/t/wkwebview-loading-local-image-files/35014)
* issues:
  * https://github.com/driftyco/ionic-app-scripts/issues/472


Dependencies:
* [cordova-plugin-camera-roll-location](https://github.com/mixersoft/cordova-plugin-camera-roll-location)
* [angular2-google-maps](https://github.com/SebastianM/angular2-google-maps) v0.15.0 

Github Repo
* [ionic2-camera-roll-virtual-scroll](https://github.com/mixersoft/ionic2-camera-roll-virtual-scroll) 

## project setup & config from Github
```
git clone https://github.com/mixersoft/ionic2-camera-roll-virtual-scroll.git
cd ionic2-camera-roll-virtual-scroll
npm install
# run in browser
ionic serve
# run on iOS
ionic plugin add cordova-plugin-add-swift-support --save
ionic plugin add cordova-plugin-camera-roll-location --save
ionic plugin add cordova-plugin-file --save 
ionic platform add ios
ionic build ios
ionic emulate ios
```


## project setup from scratch
This project was developed against `ionic-angular@2.0.0-rc.3`. Follow these steps to rebuild the project against `ionic-angular@latest`.

### check ionic framework version
```
ionic -v
# npm install -g ionic
npm install ionic-angular@latest --save
npm install @ionic/app-scripts@latest --save-dev
```

### starter project
```
ionic start ionic2-virtual-scroll tabs -v2
cd ionic2-virtual-scroll/
npm rebuild node-sass
ionic serve
```

### add `cordova-plugin-camera-roll-location`
```
ionic plugin add cordova-plugin-add-swift-support --save
ionic plugin add cordova-plugin-camera-roll-location --save
ionic plugin add cordova-plugin-file --save 
ionic build ios
```

### add modules from [ionic2-camera-roll-location-demo](https://github.com/mixersoft/ionic2-camera-roll-location-demo)
```
# "angular2-google-maps": "0.15.0", => "@angular/common": "2.1.1"
npm install angular2-google-maps@0.15.0 --save
npm install @types/googlemaps --save-dev
# ionic g page map

# additional dependencies
npm install lodash --save
npm isntall @types/lodash --save-dev
```

manual changes
* add `ionic2-camera-roll-location-demo/src/shared` folder
* add code to page `MapPage`


### add `imageScroll`
```
# ionic g page imageScroll
```

