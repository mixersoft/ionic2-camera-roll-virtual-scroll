import { Component } from '@angular/core';

import { HomePage } from '../home/home';
import { AboutPage } from '../about/about';
import { ContactPage } from '../contact/contact';
import { MapPage } from '../map/map';
import { ImageScrollPage } from '../image-scroll/image-scroll';
import { MomentPage } from '../moment/moment';

@Component({
  templateUrl: 'tabs.html'
})
export class TabsPage {
  // this tells the tabs component which Pages
  // should be each tab's root Page
  tab1Root: any = HomePage;
  tab2Root: any = AboutPage;
  tab3Root: any = ContactPage;
  tabMapRoot: any = MapPage;
  tabImageScrollRoot: any = ImageScrollPage;
  tabMomentRoot: any = MomentPage;

  constructor() {

  }
}
