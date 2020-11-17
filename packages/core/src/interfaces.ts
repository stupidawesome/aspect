import { ɵComponentDef } from '@angular/core';
import { OperatorFunction } from 'rxjs';

export type ComponentDef<T> = ɵComponentDef<T> & {
    onInit: Function
    doCheck: Function
    afterContentInit: Function
    afterContentChecked: Function
    afterViewInit: Function
    afterViewChecked: Function
    onDestroy: Function
}

export interface AspectOptions {
    on?: OperatorFunction<any, any>
}

export interface ComponentDefFeature {
    <T>(componentDef: ComponentDef<T>): void;
    /**
     * Marks a feature as something that {@link InheritDefinitionFeature} will
     * execute during inheritance.
     *
     * NOTE: DO NOT SET IN ROOT OF MODULE! Doing so will result in
     * tree-shakers/bundlers identifying the change as a side effect, and the
     * feature will be included in every bundle.
     */
    ngInherit?: true;
}

export type ComponentDefFeatures = ReadonlyArray<ComponentDefFeature>;
