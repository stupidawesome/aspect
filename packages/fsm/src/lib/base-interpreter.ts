import { ScxmlEvent, StateSchema, TransitionSchema, InvokeSchema, Schema, HistoryValue, HistoryContent } from "./schema"
import {
    BlockingQueue,
    conditionMatch,
    documentOrder,
    entryOrder,
    exitOrder,
    getChildStates,
    getProperAncestors,
    isAtomicState,
    isCancelEvent,
    isCompoundState,
    isCompoundStateOrScxmlElement,
    isDescendant,
    isFinalState,
    isHistoryState,
    isParallelState,
    isSCXMLElement,
    nameMatch,
    OrderedSet,
    Queue,
} from "./utils"
import { Reducer } from "@aspect/store"

export abstract class BaseInterpreter<T extends { [key: string]: any } = any> {
    running = false
    historyValue: HistoryValue = {}
    configuration = new OrderedSet<StateSchema>()
    statesToInvoke = new OrderedSet<StateSchema>()
    internalQueue = new Queue()
    externalQueue = new BlockingQueue()
    context = {}
    invokes: { [key: string]: any } = {}
    parent?: BaseInterpreter

    constructor(schema: Schema<T>, parent?: BaseInterpreter) {
        const doc = schema
        this.parent = parent
        this.running = true
        const initialState = doc.find(element => element instanceof StateSchema && element.initial) as StateSchema
        this.enterStates([new TransitionSchema().to(initialState.id)])
        void this.mainEventLoop()
    }

    isInFinalState(state: StateSchema): boolean {
        const { configuration } = this
        if (isCompoundState(state)) {
            return getChildStates(state).some(
                s => isFinalState(s) && configuration.has(s),
            )
        } else if (isParallelState(state)) {
            return getChildStates(state).every(this.isInFinalState, this)
        } else {
            return false
        }
    }

    addAncestorStatesToEnter(
        state: StateSchema,
        parent: StateSchema | null,
        statesToEnter: OrderedSet<StateSchema>,
        statesForDefaultEntry: OrderedSet<StateSchema>,
        defaultHistoryContent: HistoryContent,
    ) {
        for (const anc of getProperAncestors(state, parent)) {
            statesToEnter.add(anc)
            if (isParallelState(anc)) {
                for (const child of getChildStates(anc)) {
                    if (!statesToEnter.some(s => isDescendant(s, child))) {
                        this.addDescendantStatesToEnter(
                            child,
                            statesToEnter,
                            statesForDefaultEntry,
                            defaultHistoryContent,
                        )
                    }
                }
            }
        }
    }

    addDescendantStatesToEnter(
        state: StateSchema,
        statesToEnter: OrderedSet<StateSchema>,
        statesForDefaultEntry: OrderedSet<StateSchema>,
        defaultHistoryContent: HistoryContent,
    ) {
        const { historyValue } = this
        if (isHistoryState(state)) {
            if (historyValue[state.id]) {
                for (const s of historyValue[state.id]) {
                    this.addDescendantStatesToEnter(
                        s,
                        statesToEnter,
                        statesForDefaultEntry,
                        defaultHistoryContent,
                    )
                    this.addAncestorStatesToEnter(
                        s,
                        state.parent,
                        statesToEnter,
                        statesForDefaultEntry,
                        defaultHistoryContent,
                    )
                }
            } else {
                defaultHistoryContent[
                    state.parent.id
                    ] = state.transitions.reduce((a, t) => a.concat(t.actions), [] as Reducer<any, any>[])

                for (const s of state.transitions[0].target) {
                    this.addDescendantStatesToEnter(
                        s,
                        statesToEnter,
                        statesForDefaultEntry,
                        defaultHistoryContent,
                    )
                    if (state.parent) {
                        this.addAncestorStatesToEnter(
                            s,
                            state.parent,
                            statesToEnter,
                            statesForDefaultEntry,
                            defaultHistoryContent,
                        )
                    }
                }
            }
        } else {
            statesToEnter.add(state)
            if (isCompoundState(state)) {
                statesForDefaultEntry.add(state)
                for (const s of state.initial.transition.target) {
                    this.addDescendantStatesToEnter(
                        s,
                        statesToEnter,
                        statesForDefaultEntry,
                        defaultHistoryContent,
                    )
                    this.addAncestorStatesToEnter(
                        s,
                        state,
                        statesToEnter,
                        statesForDefaultEntry,
                        defaultHistoryContent,
                    )
                }
            } else {
                if (isParallelState(state)) {
                    for (const child of getChildStates(state)) {
                        if (!statesToEnter.some(s => isDescendant(s, child))) {
                            this.addDescendantStatesToEnter(
                                child,
                                statesToEnter,
                                statesForDefaultEntry,
                                defaultHistoryContent,
                            )
                        }
                    }
                }
            }
        }
    }

    findLCCA(stateList: StateSchema[]) {
        for (const anc of getProperAncestors(stateList[0], null).filter(
            isCompoundStateOrScxmlElement,
        )) {
            if (stateList.slice(1).every(s => isDescendant(s, anc))) {
                return anc
            }
        }
    }

    getTransitionDomain(t: TransitionSchema) {
        const tstates = this.getEffectiveTargetStates(t)
        if (!tstates) {
            return null
        } else if (
            t.source &&
            t.type === "internal" &&
            isCompoundState(t.source) &&
            tstates.every(s => isDescendant(s, t.source))
        ) {
            return t.source
        } else {
            return this.findLCCA([t.source].concat(tstates.toList()))
        }
    }

    computeEntrySet(
        enabledTransitions: TransitionSchema[],
        statesToEnter: OrderedSet<StateSchema>,
        statesForDefaultEntry: OrderedSet<StateSchema>,
        defaultHistoryContent: HistoryContent,
    ) {
        for (const t of enabledTransitions) {
            for (const s of t.target) {
                this.addDescendantStatesToEnter(
                    s,
                    statesToEnter,
                    statesForDefaultEntry,
                    defaultHistoryContent,
                )
            }
            const ancestor = this.getTransitionDomain(t) ?? null
            for (const s of this.getEffectiveTargetStates(t)) {
                this.addAncestorStatesToEnter(
                    s,
                    ancestor,
                    statesToEnter,
                    statesForDefaultEntry,
                    defaultHistoryContent,
                )
            }
        }
    }

    getEffectiveTargetStates(transition: TransitionSchema) {
        const { historyValue } = this
        const targets = new OrderedSet<StateSchema>()
        for (const s of transition.target) {
            if (isHistoryState(s)) {
                if (historyValue[s.id]) {
                    targets.union(historyValue[s.id])
                } else {
                    for (const t of s.transitions) {
                        targets.union(this.getEffectiveTargetStates(t))
                    }
                }
            } else {
                targets.add(s)
            }
        }
        return targets
    }

    removeConflictingTransitions(
        enabledTransitions: OrderedSet<TransitionSchema>,
    ) {
        const filteredTransitions = new OrderedSet<TransitionSchema>()
        //toList sorts the transitions in the order of the states that selected them
        for (const t1 of enabledTransitions.toList()) {
            let t1Preempted = false
            const transitionsToRemove = new OrderedSet<TransitionSchema>()
            for (const t2 of filteredTransitions.toList()) {
                if (
                    this.computeExitSet([t1]).hasIntersection(
                        this.computeExitSet([t2]),
                    )
                ) {
                    if (t1.source && isDescendant(t1.source, t2.source)) {
                        transitionsToRemove.add(t2)
                    } else {
                        t1Preempted = true
                        break
                    }
                }
            }
            if (!t1Preempted) {
                for (const t3 of transitionsToRemove.toList()) {
                    filteredTransitions.delete(t3)
                }
                filteredTransitions.add(t1)
            }
        }
        return filteredTransitions
    }

    computeExitSet(transitions: TransitionSchema[]) {
        const { configuration } = this
        const statesToExit = new OrderedSet<StateSchema>()
        for (const t of transitions) {
            if (t.target.length > 0) {
                const domain = this.getTransitionDomain(t)
                for (const s of configuration) {
                    if (isDescendant(s, domain)) {
                        statesToExit.add(s)
                    }
                }
            }
        }
        return statesToExit
    }

    selectEventlessTransitions() {
        const { configuration, context } = this
        const enabledTransitions = new OrderedSet<TransitionSchema>()
        const atomicStates = configuration
            .toList()
            .filter(isAtomicState)
            .sort(documentOrder)

        for (const state of atomicStates) {
            loop: for (const s of [state].concat(
                getProperAncestors(state, null),
            )) {
                console.log('hi!', s)
                for (const t of s.transitions.slice().sort(documentOrder)) {
                    if (!t.event && conditionMatch(t, context)) {
                        enabledTransitions.add(t)
                        break loop
                    }
                }
            }
        }

        return this.removeConflictingTransitions(enabledTransitions)
    }

    selectTransitions(event: { name: string }) {
        const { configuration, context } = this
        const enabledTransitions = new OrderedSet<TransitionSchema>()
        const atomicStates = configuration
            .toList()
            .filter(isAtomicState)
            .sort(documentOrder)

        for (const state of atomicStates) {
            loop: for (const s of [state].concat(
                getProperAncestors(state, null),
            )) {
                for (const t of s.transitions.slice().sort(documentOrder)) {
                    if (
                        t.event &&
                        nameMatch(t.event, event.name) &&
                        conditionMatch(t, context)
                    ) {
                        enabledTransitions.add(t)
                        break loop
                    }
                }
            }
        }

        return this.removeConflictingTransitions(enabledTransitions)
    }

    microstep(enabledTransitions: TransitionSchema[]) {
        this.exitStates(enabledTransitions)
        this.executeTransitionContent(enabledTransitions)
        this.enterStates(enabledTransitions)
    }

    exitStates(enabledTransitions: TransitionSchema[]) {
        const { configuration, statesToInvoke, historyValue } = this
        const statesToExit = this.computeExitSet(enabledTransitions)
        for (const s of statesToExit) {
            statesToInvoke.delete(s)
        }
        const listOfStatesToExit = statesToExit.toList().sort(exitOrder)
        for (const s of listOfStatesToExit) {
            for (const h of s.history) {
                const f =
                    h.type === "deep"
                        ? (s0: any) => isAtomicState(s0) && isDescendant(s0, s)
                        : (s0: any) => s0.parent === s

                historyValue[h.def.id] = configuration.toList().filter(f)
            }
            for (const _s of listOfStatesToExit) {
                this.executeContent(_s.onexit)
                for (const inv of _s.invoke) {
                    this.cancelInvoke(inv)
                }
                configuration.delete(_s)
            }
        }
    }

    executeTransitionContent(enabledTransitions: TransitionSchema[]) {
        for (const t of enabledTransitions) {
            this.executeContent(t)
        }
    }

    async mainEventLoop() {
        const {
            internalQueue,
            externalQueue,
            configuration,
            statesToInvoke,
        } = this
        while (this.running) {
            let enabledTransitions = null
            let macrostepDone = false

            while (this.running && !macrostepDone) {
                enabledTransitions = this.selectEventlessTransitions()
                if (enabledTransitions.isEmpty()) {
                    if (internalQueue.isEmpty()) {
                        macrostepDone = true
                    } else {
                        const internalEvent = internalQueue.dequeue()
                        enabledTransitions = this.selectTransitions(
                            internalEvent,
                        )
                    }
                }

                if (!enabledTransitions.isEmpty()) {
                    this.microstep(enabledTransitions.toList())
                }
            }

            // either we're in a final state, and we break out of the loop
            if (!this.running) {
                break
            }
            // or we've completed a macrostep, so we start a new macrostep by waiting for an external event
            // Here we invoke whatever needs to be invoked. The implementation of 'invoke' is platform-specific
            for (const state of statesToInvoke.toList().sort(entryOrder)) {
                for (const inv of state.invoke.sort(documentOrder)) {
                    this.invoke(inv)
                }
            }
            statesToInvoke.clear()
            // Invoking may have raised internal error events and we iterate to handle them
            if (!internalQueue.isEmpty()) {
                continue
            }
            // A blocking wait for an external event. Alternatively, if we have been invoked
            // our parent session also might cancel us. The mechanism for this is platform specific,
            // but here we assume it’s a special event we receive
            const externalEvent: ScxmlEvent = await externalQueue.dequeue()
            if (isCancelEvent(externalEvent)) {
                this.running = false
                continue
            }
            for (const state of configuration) {
                for (const inv of state.invoke) {
                    if (inv.id === externalEvent.invokeid) {
                        this.applyFinalize(inv, externalEvent)
                    }
                    if (inv.autoforward || inv.id === externalEvent.target) {
                        this.send(externalEvent, inv.id)
                    }
                }
            }
            enabledTransitions = this.selectTransitions(externalEvent)
            if (!enabledTransitions.isEmpty()) {
                this.microstep(enabledTransitions.toList())
            }
            // this.tick.next(this.datamodel)
        }
        // End of outer while running loop. If we get here, we have reached a top-level final state or have been cancelled
        this.exitInterpreter()
    }

    exitInterpreter() {
        const { configuration } = this
        console.log(
            "final state:",
            configuration
                .toList()
                .sort(exitOrder)
                .filter(Boolean)
                .map(s => s.id)
                .join(", "),
        )
        const statesToExit = configuration.toList().sort(exitOrder)
        for (const s of statesToExit) {
            this.executeContent(s.onexit)
            for (const inv of s.invoke) {
                this.cancelInvoke(inv)
            }
            configuration.delete(s)
            if (isFinalState(s) && isSCXMLElement(s.parent)) {
                this.returnDoneEvent(s.donedata)
            }
        }
    }

    enterStates(enabledTransitions: TransitionSchema[]) {
        const { configuration, statesToInvoke } = this
        const statesToEnter = new OrderedSet<StateSchema>()
        const statesForDefaultEntry = new OrderedSet<StateSchema>()
        const defaultHistoryContent: HistoryContent = {}

        this.computeEntrySet(
            enabledTransitions,
            statesToEnter,
            statesForDefaultEntry,
            defaultHistoryContent,
        )

        for (const s of statesToEnter.toList().sort(entryOrder)) {
            configuration.add(s)
            statesToInvoke.add(s)
            this.executeContent(s.onentry)
            if (statesForDefaultEntry.has(s)) {
                this.executeContent(s.initial.transition)
            }
            if (isFinalState(s)) {
                if (isSCXMLElement(s.parent)) {
                    this.running = false
                } else {
                    const parent = s.parent
                    if (parent) {
                        const grandparent = parent.parent
                        const event: ScxmlEvent = {
                            ...s.donedata,
                            name: "done.state." + parent.id,
                        }
                        this.internalQueue.enqueue(event)
                        if (grandparent && isParallelState(grandparent)) {
                            if (
                                getChildStates(grandparent).every(
                                    this.isInFinalState,
                                    this,
                                )
                            ) {
                                this.internalQueue.enqueue(
                                    new Event("done.state." + grandparent.id),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    abstract invoke(inv: InvokeSchema): any

    abstract executeContent(content: any): any

    abstract cancelInvoke(inv: any): any

    abstract returnDoneEvent(donedata: any): any

    abstract send(event: any, target?: string): any

    abstract applyFinalize(inv: any, externalEvent: any): any
}
