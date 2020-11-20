import { NgModule, Pipe, PipeTransform } from '@angular/core';
import { Ref } from './ref';

@Pipe({
    name: "ref",
    pure: true
})
export class RefPipe implements PipeTransform {
    transform(value: any): any {
        return new Ref(value)
    }
}

@NgModule({
    declarations: [RefPipe]
})
export class AspectModule {}
