import { Action, Actions } from '@aspect/store';
import { Observable, throwError } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import {BaseInterpreter} from "./base-interpreter";
import { EXTENDED_STATE, InvokeSchema, Schema, ScxmlEvent, StateSchema, TransitionSchema } from './schema';
import { Injectable, Injector } from "@angular/core"

@Injectable()
export class Interpreter extends BaseInterpreter {
    callbacks = new Map();
    state: any

    // @ts-ignore
    constructor(private injector: Injector, schema: Schema<any>, parent?: BaseInterpreter) {
        super(schema, parent);
    }

    onStoreInit(s: any) {
        this.state = s
        const initialState = this.schema.find(element => element instanceof StateSchema && element.initial) as StateSchema
        this.enterStates([new TransitionSchema().to(initialState.id)])
        void this.mainEventLoop()
    }

    on(event: string, callback: Function) {
        (
            this.callbacks.get(event) || this.callbacks.set(event, []).get(event)
        ).push(callback);
    }

    executeContent(content: any) {
        if (content instanceof TransitionSchema) {
            content.actions.forEach(reducer => {
                reducer.reducers.forEach(([red, action]) => {
                    if ((<any>action).some((a: any) => a.name === this.event?.name)) {
                        const nextState = reducer.selector(this.state)
                        nextState(red(nextState(), this.event?.data))
                    }
                })
            })
        }
    }

    cancelInvoke(inv: InvokeSchema) {
        const instance = this.invokes[inv.id];
        if (instance instanceof BaseInterpreter) {
            instance.exitInterpreter();
        } else {
            instance.ngOnDestroy?.()
            instance.unsubscribe?.()
        }
    }

    returnDoneEvent(donedata: any) {
        const callbacks = this.callbacks.get("done");
        if (callbacks) {
            callbacks.forEach((callback: Function) => callback(donedata))
        }
    }

    send(event: ScxmlEvent, target?: string) {
        if (target === "_internal") {
            this.internalQueue.enqueue(event);
        } else if (target === "_parent" && this.parent) {
            this.parent.send(event);
        } else if (target) {
            const invoke: Interpreter = this.invokes[target];
            invoke.send({
                name: event.name,
                data: event.data,
                origin: this
            });
        } else {
            this.externalQueue.enqueue(event);
            const actions = this.injector.get(Actions)
            actions.next(event)
        }
    }

    applyFinalize(inv: any, externalEvent: any) {
        // not implemented
    }

    invoke(inv: InvokeSchema) {
        const { invokes, injector } = this;

        const effectFactory = inv.src

        const deps = injector.get(effectFactory.deps)
        const { options } = effectFactory
        for (const effect of effectFactory.effects) {
            const source: Observable<Action> = effect(deps, this.state).pipe(
                catchError((error) => {
                    if (options.restartOnError) {
                        console.error(error)
                        return source
                    }
                    return throwError(error)
                }),
                filter(event => Object(event).name)
            )
            invokes[inv.id] = source.subscribe((v) => this.send(v))
        }

        // if (!inv.type) {
        //     if (invokes[inv.id]) {
        //         throw new Error(`Already invoked "${inv.id}"`);
        //     }
        //     const child = new Interpreter(this.injector, inv.src);
        //     invokes[inv.id] = child;
        //
        //     child.on("done", () => {
        //         this.send(`done.invoke.${inv.id}`);
        //     });
        // }
    }
}
