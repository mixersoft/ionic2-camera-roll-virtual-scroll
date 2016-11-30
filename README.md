## project install & config

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
ionic g page map

# add other useful libs
npm install lodash --save
npm isntall @types/lodash --save-dev
```

manual changes
* add `ionic2-camera-roll-location-demo/src/shared` folder
* add code to page `MapPage`


### add `imageScroll`
```
ionic g page imageScroll
```

