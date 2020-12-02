import { Action, Actions } from "@aspect/store"
import { Observable, Subscription, throwError } from "rxjs"
import { catchError, filter } from "rxjs/operators"
import { BaseInterpreter } from "./base-interpreter"
import { InvokeSchema, Schema, ScxmlEvent, TransitionSchema } from "./schema"
import { ChangeDetectorRef, Injectable, Injector, OnDestroy } from "@angular/core"

@Injectable()
export class Interpreter extends BaseInterpreter implements OnDestroy {
    callbacks = new Map()
    state: any

    private sink
    private cdr: ChangeDetectorRef

    constructor(
        private injector: Injector,
        schema: Schema<any>,
        state: any,
        machine: any,
        actions: Actions,
        parent?: BaseInterpreter,
    ) {
        super(schema, state, parent)

        machine.machine = this
        this.cdr = this.injector.get(ChangeDetectorRef)
        this.sink = new Subscription()
            .add(actions.subscribe(action => this.send(action)))

        this.init()
    }

    on(event: string, callback: Function) {
        ;(
            this.callbacks.get(event) ||
            this.callbacks.set(event, []).get(event)
        ).push(callback)
    }

    executeContent(content: any) {
        if (content instanceof TransitionSchema) {
            content.actions.forEach((reducer) => {
                reducer.reducers.forEach(([red, action]) => {
                    if (
                        (<any>action).some(
                            (a: any) => a.name === this.event?.name,
                        )
                    ) {
                        const nextState = reducer.selector(this.state)
                        nextState(red(nextState(), this.event?.data))
                    }
                })
            })
        }
        this.cdr.detectChanges()
    }

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    cancelInvoke(inv: InvokeSchema) {
        const instance = this.invokes[inv.id]
        if (instance instanceof BaseInterpreter) {
            instance.exitInterpreter()
        }
        if (instance) {
            instance.ngOnDestroy?.()
            instance.unsubscribe?.()
        }
    }

    returnDoneEvent(donedata: any) {
        const callbacks = this.callbacks.get("done")
        if (callbacks) {
            callbacks.forEach((callback: Function) => callback(donedata))
        }
    }

    send(event: ScxmlEvent, target?: string) {
        if (target === "_internal") {
            this.internalQueue.enqueue(event)
        } else if (target === "_parent" && this.parent) {
            this.parent.send(event)
        } else if (target) {
            const invoke: Interpreter = this.invokes[target]
            invoke.send({
                name: event.name,
                data: event.data,
                origin: this,
            })
        } else {
            this.externalQueue.enqueue(event)
        }
    }

    applyFinalize(inv: any, externalEvent: any) {
        // not implemented
    }

    invoke(inv: InvokeSchema) {
        const { invokes, injector } = this

        const effectFactory = inv.src

        const deps = injector.get(effectFactory.deps)
        for (const [effect, options] of effectFactory.effects) {
            const source: Observable<Action> = effect(deps, this.state).pipe(
                catchError((error, caught) => {
                    const next = options.restartOnError ? caught : throwError(error)
                    console.error(error)
                    this.send(error)
                    return next
                }),
                filter((event) => Object(event).name),
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
