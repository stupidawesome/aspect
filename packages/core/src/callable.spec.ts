import { Callable } from "./callable"

describe("Callable", () => {
    it("should create an instance", () => {
        expect(new Callable(Function)).toBeTruthy()
    })
})
