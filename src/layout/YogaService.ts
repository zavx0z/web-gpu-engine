import initYoga from 'yoga-layout';

export enum YogaLoadingState {
  PENDING,
  LOADING,
  READY,
  ERROR,
}

/**
 * Singleton service for managing the asynchronous lifecycle of Yoga Layout.
 * Handles WASM loading and prevents race conditions.
 */
export class YogaService {
  private static _instance: YogaService;

  public static get instance(): YogaService {
    if (!YogaService._instance) {
      YogaService._instance = new YogaService();
    }
    return YogaService._instance;
  }

  private _state: YogaLoadingState = YogaLoadingState.PENDING;
  private _yoga: any = null;
  private initializationPromise: Promise<any> | null = null;

  private constructor() {}

  public get state(): YogaLoadingState {
    return this._state;
  }

  /**
   * Initializes the Yoga WASM module. Safe to call multiple times.
   * Returns a promise that resolves when Yoga is ready.
   */
  public async initialize(): Promise<any> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this._state = YogaLoadingState.LOADING;
    console.log('YogaService: Starting WASM loading...');

    this.initializationPromise = (async () => {
      try {
        // Fetch the WASM file manually to support various bundlers and environments
        const response = await fetch('/yoga.wasm');
        if (!response.ok) {
          throw new Error(`Failed to load /yoga.wasm: ${response.status} ${response.statusText}`);
        }
        const wasmBuffer = await response.arrayBuffer();
        console.log(`YogaService: Downloaded WASM size: ${wasmBuffer.byteLength} bytes`);

        // Handle ESM default export inconsistencies
        const initFn = (initYoga as any).default || initYoga;
        const loaded = await initFn(wasmBuffer);

        // Normalize the loaded module to ensure we have access to the API
        if (loaded && loaded.Node) {
          this._yoga = loaded;
        } else if (loaded && loaded.default && loaded.default.Node) {
          this._yoga = loaded.default;
        } else if (loaded && loaded.Yoga && loaded.Yoga.Node) {
          this._yoga = loaded.Yoga;
        } else {
          this._yoga = loaded;
          console.warn('YogaService: Loaded object structure unknown, using as is.', Object.keys(loaded));
        }

        this._state = YogaLoadingState.READY;
        console.log('YogaService: WASM loaded successfully.');
        return this._yoga;
      } catch (error) {
        this._state = YogaLoadingState.ERROR;
        this.initializationPromise = null;
        console.error('YogaService: Error loading WASM:', error);
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Returns the initialized Yoga instance.
   * @throws Error if usage is attempted before initialization.
   */
  public get yoga(): any {
    if (this._state !== YogaLoadingState.READY || !this._yoga) {
      throw new Error('YogaService not ready. Call await YogaService.instance.initialize() first.');
    }
    return this._yoga;
  }
}

export default YogaService;