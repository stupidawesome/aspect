import {
    ChangeDetectorRef,
    INJECTOR,
    SimpleChanges, Type,
    ɵNG_COMP_DEF,
    ɵNG_DIR_DEF,
    ɵɵdirectiveInject as directiveInject,
} from "@angular/core"
import { Subject } from 'rxjs';
import { isArray } from "rxjs/internal-compatibility"
import {
    createCheckFeature,
    createErrorFeature, createInitFeature,
    createObserveFeature, detectChanges, wrap,
} from "./features/check"
import { AspectOptions } from "./interfaces"
import { Ref } from './ref';
import { Reflection } from "./reflection"
import { STORE_INITIALIZER } from "@aspect/store"
import { tap } from "rxjs/operators"

export function UseFeatures() {
    return function (target: any) {
        const { prototype } = target
        const features = []
        const errorHandlerMap = new WeakMap()
        const componentDef = target[ɵNG_COMP_DEF] ?? target[ɵNG_DIR_DEF]
        const origFactory = componentDef.type.ɵfac
        const injectors = new WeakMap()

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
        target.prototype.ngOnInit = wrap(target.prototype.ngOnInit, function (this: any) {
            injectors.get(this).get(STORE_INITIALIZER)
        })

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
            const changeDetectorRef = directiveInject(ChangeDetectorRef as Type<ChangeDetectorRef>)
            errorHandlerMap.set(instance, errorSubject)
            errorSubject.subscribe({
                next(err) {
                    if (errorSubject.observers.length <= 1) {
                        throw err
                    }
                }
            })
            injectors.set(instance, directiveInject(INJECTOR))
            instance[detectChanges] = (source: any) => {
                return source.pipe(tap(() => changeDetectorRef.detectChanges()))
            }
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
