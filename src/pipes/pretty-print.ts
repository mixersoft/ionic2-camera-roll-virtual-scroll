import { Injectable, Pipe } from '@angular/core';

/*
  Generated class for the PrettyPrint pipe.

  See https://angular.io/docs/ts/latest/guide/pipes.html for more info on
  Angular 2 Pipes.
*/
@Pipe({
  name: 'prettyprint'
})
@Injectable()
export class PrettyPrintPipe {
  /*
    Takes a value and makes it lowercase.
   */
  transform(value, args) {
    return JSON.stringify(value, null, 2)
      .replace(' ', '&nbsp;')
      .replace('\n', '<br/>');
  }
}
