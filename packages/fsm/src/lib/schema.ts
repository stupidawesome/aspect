import { InjectionToken, Injector, INJECTOR, Provider } from '@angular/core';
import { Actions, ActionType, Reducer, STORE_INITIALIZER } from '@aspect/store';
import { Interpreter } from './interpreter';

export type Schema<T> = Array<
    StateSchema<any> | TransitionSchema | InvokeSchema
>

export function schema<T>(...children: Schema<T>): Schema<any> {
    return children
}

export enum StateMode {
    default = "default",
    parallel = "parallel",
    final = "final",
    history = "history"
}

export interface ScxmlEvent {
    name: string;
    type?: "internal" | "external";
    sendId?: string | undefined;
    origin?: any;
    originType?: string | undefined;
    invokeid?: string | undefined;
    data: any;
    target?: string;
}

let documentOrder = 0

export interface HistoryValue {
    [key: string]: StateSchema[]
}

export interface HistoryContent {
    [key: string]: Reducer<any, any>[];
}

const rootElement: StateSchema = {
    id: "__ROOT__",
    ancestors: [],
    atomic: false,
    depth: 0,
    descendants: [],
    documentOrder: 0,
    donedata: undefined,
    history: [],
    initial: undefined,
    invoke: [],
    mode: undefined,
    onentry: [],
    onexit: [],
    parent: null,
    transitions: []
}

export class StateSchema<T = any> {
    initial
    mode
    parent: StateSchema | null
    ancestors: StateSchema[]
    descendants: StateSchema[]
    atomic
    documentOrder
    depth
    transitions: TransitionSchema[]
    invoke: any[]
    onentry: any[]
    onexit: any[]
    history: any[]
    donedata: any

    constructor(public id: string, children: any[], options: any) {
        this.initial = options.initial
        this.mode = options.mode
        this.descendants = []
        this.ancestors = [rootElement]
        this.documentOrder = documentOrder++
        this.parent = rootElement as any
        this.transitions = []
        this.invoke = []
        this.onentry = []
        this.onexit = []
        this.history = []
        this.donedata = {}

        states.set(id, this)

        for (const child of children) {
            if (child instanceof StateSchema) {
                child.parent = this
                child.ancestors.push(this)
                this.descendants.concat(child, child.descendants)
                if (child.mode === StateMode.history) {
                    this.history.push(child)
                }
            }
            if (child instanceof InvokeSchema) {
                this.invoke.push(child)
            }
        }

        this.atomic = this.descendants.length === 0
        this.depth = this.ancestors.length

        for (const child of children){
            if (child instanceof TransitionSchema) {
                this.transitions.push(child)
                child.source = this
                child.depth = this.depth
            }
        }
    }
}

export function state<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.default })
}

export function initial<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { initial: true, mode: StateMode.default })
}

export function final<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.final })
}

export function history<T>(name: string, ...children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.history })
}

const states = new Map()

export class TransitionSchema {
    event: any[]
    cond: Function
    get target(): StateSchema[] {
        return this.targetNames.map(targetName => states.get(targetName))
    }
    actions: Reducer<any, any>[]
    source: StateSchema
    targetNames: string[]
    documentOrder
    depth
    get type(): "internal" | "external" {
        return this.targetNames.length ? "external" : "internal"
    }

    to(...targets: string[]) {
        this.targetNames = targets
        return this
    }

    when(cond: (state: any, action: any) => boolean) {
        this.cond = cond
        return this
    }

    action(...actions: Reducer<any, any>[]) {
        this.actions = actions
        return this
    }

    constructor(...events: ActionType<any>[]) {
        this.event = events
        this.targetNames = []
        this.actions = []
        this.cond = () => true
        this.source = new StateSchema<any>("", [], {})
        this.documentOrder = documentOrder++
        this.depth = 0
    }
}

export function transition(...actions: ActionType<any>[]) {
    return new TransitionSchema(actions)
}

export class InvokeSchema {
    constructor(public id: string, public src: any, public type = "") {}
}

let invId = 0

export function invoke(src: any) {
    return new InvokeSchema(`$$inv${invId++}`, src)
}

export interface DocumentOrder {
    documentOrder: number
    depth: number
}

export const EXTENDED_STATE = new InjectionToken("EXTENDED_STATE")

export class MachineState {
    private machine!: any
    private initialState
    get state(): any[] {
        return this.machine?.configuration.toList().map((s: any) => s.id) ?? [this.initialState.id]
    }
    matches(...stateNames: string[]) {
        return this.machine?.configuration.toList().every((s: StateSchema) => stateNames.includes(s.id)) ?? stateNames.every(s => this.initialState.id === s)
    }
    constructor(sch: Schema<any>) {
        this.initialState = sch.find(element => element instanceof StateSchema && element.initial) as StateSchema
    }
}

export function createFsm(finiteStates: any, dataModel: any): (...children: Schema<any>) => Provider {
    return function(...children: Schema<any>) {
        return [{
            provide: STORE_INITIALIZER,
            useFactory: (injector: Injector, extendedState: any, actions: any, machine: any) => {
                return new Interpreter(injector, schema(...children), extendedState, machine, actions)
            },
            deps: [INJECTOR, EXTENDED_STATE, Actions, MachineState],
            multi: true
        }, {
            provide: EXTENDED_STATE,
            useExisting: dataModel
        }, {
            provide: MachineState,
            useFactory: () => {
                return new MachineState(schema(...children))
            }
        }]
    }
}
