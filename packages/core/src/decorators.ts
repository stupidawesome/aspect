import { SimpleChanges, ɵNG_COMP_DEF, ɵNG_DIR_DEF } from '@angular/core';
import { Subject } from 'rxjs';
import { isArray } from "rxjs/internal-compatibility"
import {
    createCheckFeature,
    createErrorFeature, createInitFeature,
    createObserveFeature, wrap
} from './features/check';
import { AspectOptions } from "./interfaces"
import { Ref } from './ref';
import { Reflection } from "./reflection"

export function UseFeatures() {
    return function (target: any) {
        const { prototype } = target
        const features = []
        const errorHandlerMap = new WeakMap()
        const componentDef = target[ɵNG_COMP_DEF] ?? target[ɵNG_DIR_DEF]
        const origFactory = componentDef.type.ɵfac

        for (const propertyKey of Reflection.getOwnMetadataProperties(
            prototype,
        )) {
            const metakeys = Reflection.getOwnMetadataKeys(
                prototype,
                propertyKey,
            )
            for (const metadataKey of metakeys) {
                const factory = Reflection.getOwnMetadata(
                    metadataKey,
                    prototype,
                    propertyKey,
                )
                if (factory) {
                    features.push([factory, metadataKey])
                }
            }
        }

        target.prototype.ngOnChanges = wrap(target.prototype.ngOnChanges, function (this: any, changes: SimpleChanges) {
            const changeKeys = Object.keys(changes)
            for (const change of changeKeys) {
                if (changes[change].previousValue instanceof Ref) {
                    this[change] = changes[change].previousValue
                }
            }
            for (const change of changeKeys) {
                this[change](changes[change].currentValue)
            }
        })

        componentDef.factory = function () {
            const instance = origFactory()
            const errorSubject = new Subject()
            errorHandlerMap.set(instance, errorSubject)
            errorSubject.subscribe({
                next(err) {
                    if (errorSubject.observers.length <= 1) {
                        throw err
                    }
                }
            })
            return instance
        }

        features.reverse().sort(([,a], [,b]) => {
            const compA = (<any>Decorators)[a]
            const compB = (<any>Decorators)[b]
            if (compA < compB) {
                return 1
            }
            if (compB < compA) {
                return -1
            }
            return 0
        }).forEach(([feature]) => feature(target, errorHandlerMap))
    }
}

enum Decorators {
    ErrorListener = "ErrorListener",
    OnInit = "OnInit",
    OnViewInit = "OnViewInit",
    OnContentInit = "OnContentInit",
    DoCheck = "DoCheck",
    ContentCheck = "ContentCheck",
    ViewCheck = "ViewCheck",
    OnDestroy = "OnDestroy"
}

export function DoCheck(paths: string | string[], aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.DoCheck, createCheckFeature(isArray(paths) ? paths : [paths], descriptor, aspectOptions, "ngDoCheck"), target, propertyKey)
    }
}

export function ContentCheck(paths: string | string[], aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.ContentCheck, createCheckFeature(isArray(paths) ? paths : [paths], descriptor, aspectOptions, "ngAfterContentChecked"), target, propertyKey)
    }
}

export function ViewCheck(paths: string | string[], aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.ViewCheck, createCheckFeature(isArray(paths) ? paths : [paths], descriptor, aspectOptions, "ngAfterViewChecked"), target, propertyKey)
    }
}

export function Observe(paths: string | string[], aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.DoCheck, createObserveFeature(isArray(paths) ? paths : [paths], descriptor, aspectOptions), target, propertyKey)
    }
}

export function OnInit(aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.OnInit, createInitFeature(descriptor, aspectOptions, "ngOnInit"), target, propertyKey)
    }
}

export function OnContentInit(aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.OnContentInit, createInitFeature(descriptor, aspectOptions, "ngAfterContentInit"), target, propertyKey)
    }
}

export function OnViewInit(aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.OnViewInit, createInitFeature(descriptor, aspectOptions, "ngAfterViewInit"), target, propertyKey)
    }
}

export function ErrorListener(aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.ErrorListener, createErrorFeature(descriptor, aspectOptions), target, propertyKey)
    }
}
