import { InMemoryTapeCassette } from '../playback';
import { TapeRecorder } from '../playback/tapeRecorder';
import { v4 as uuid } from "uuid";

let tapeCassette = new InMemoryTapeCassette();
let tapeRecorder = new TapeRecorder(tapeCassette);
tapeRecorder.enableRecording();

class ServiceOperation {
    private multiply = 10;
    constructor() { }

    /**
     * Executes the operation and return the key of where the result is stored
     * @returns Promise<string>
     */
    public execute() {
        const operation = async () => {
            const data = this.getRequestData(10);
            let result = this.doSomethingWithInput(data);
            result = await this.doSomethingAsyncWithInput(result, 2);
            const storageKey = this.storeResult(result);
            return storageKey
        }

        const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
        );
        return wrapOperation();
    }

    /**
     * Reads the required input for the operation
     * @returns number
     */
    @tapeRecorder.decoratorInterceptInput()
    private getRequestData(rangeMax: number) {
        //  Fake input that will be captured in the recording
        return Math.floor(Math.random() * rangeMax) + 1;
    }

    /**
     * Stores the operation result and return the key that can be used to fetch the result
     * @param result string
     * @returns string
     */
    @tapeRecorder.decoratorInterceptOutput()
    private storeResult(result: any) {
        return this.putResultInMongo(result);
    }

    /**
     * Apply some logic on input
     * @param input 
     * @returns number
     */
    private doSomethingWithInput(input: any) {
        return input * this.multiply;
    }

    /**
     * Apply some logic on input (async)
     * @param input 
     * @returns Promise<number>
     */
    private async doSomethingAsyncWithInput(input: any, myNumber: number) {
        await this.delay(1000);
        return input * myNumber;
    }

    /**
     * Stores the result in mongo
     * @param result 
     * @returns string
     */
    private putResultInMongo(result: any) {
        // Fake output, we don't really need to store anything in the example, return a fake document id
        return uuid();
    }

    private delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}


// Init the service here
const operationService = new ServiceOperation();
operationService.execute()
    .then(result => {
        const recordingId = tapeCassette.getLastRecordingId();
        if (!recordingId) {
            return;
        }

        // Replay last recorded operation
        const playbackResult = tapeRecorder.play(
            recordingId,
            operationService.execute.bind(operationService)
        );

        playbackResult.then(playbackResult => {
            // TODO: run comparison and output comparison result using the Equalizer
            console.log(playbackResult);
        })
    })
