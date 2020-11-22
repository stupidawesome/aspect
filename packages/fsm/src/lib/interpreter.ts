import {BaseInterpreter} from "./base-interpreter";
import { InvokeSchema, Schema } from "./schema"
import { Injectable, Injector } from "@angular/core"

@Injectable()
export class Interpreter extends BaseInterpreter {
    callbacks = new Map();

    constructor(private injector: Injector, schema: Schema<any>, parent?: BaseInterpreter) {
        super(schema, parent);
    }

    on(event: string, callback: Function) {
        (
            this.callbacks.get(event) || this.callbacks.set(event, []).get(event)
        ).push(callback);
    }

    executeContent(content: any) {
       // apply reducers
    }

    cancelInvoke(inv: InvokeSchema) {
        const instance = this.invokes[inv.id];
        if (instance instanceof BaseInterpreter) {
            instance.exitInterpreter();
        } else {
            instance?.ngOnDestroy()
        }
    }

    returnDoneEvent(donedata: any) {
        const callbacks = this.callbacks.get("done");
        if (callbacks) {
            callbacks.forEach((callback: Function) => callback(donedata))
        }
    }

    send(event: any, target?: string) {
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
        }
    }

    applyFinalize(inv: any, externalEvent: any) {
        // not implemented
    }

    invoke(inv: InvokeSchema) {
        const { invokes } = this;

        if (!inv.type) {
            if (invokes[inv.id]) {
                throw new Error(`Already invoked "${inv.id}"`);
            }
            const child = new Interpreter(this.injector, inv.src);
            invokes[inv.id] = child;

            child.on("done", () => {
                this.send(`done.invoke.${inv.id}`);
            });
        } else {
            invokes[inv.id] = this.injector.get(inv.src)
        }
    }
}
