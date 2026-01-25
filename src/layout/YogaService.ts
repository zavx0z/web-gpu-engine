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
        // Используем браузерную сборку с base64 WASM встроенным в код
        // Браузер не может импортировать из node_modules напрямую, поэтому используем URL
        console.log('YogaService: Dynamically importing yoga-layout browser build...');
        
        // Пробуем несколько вариантов импорта
        let yogaModule;
        try {
          // Вариант 1: Прямой импорт через наш сервер (нужно добавить маршрут в server.ts)
          yogaModule = await import('/yoga-wasm-base64-esm.js');
        } catch (e) {
          // Вариант 2: Используем оригинальный пакет через скрипт-тег
          console.log('YogaService: Falling back to manual loading...');
          
          // Создаем script элемент для загрузки UMD версии
          const script = document.createElement('script');
          script.src = '/yoga-wasm-base64-umd.js';
          script.type = 'text/javascript';
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          
          // UMD версия экспортирует Yoga в глобальную область видимости
          // @ts-ignore
          if (typeof window.Yoga !== 'undefined') {
            // @ts-ignore
            this._yoga = window.Yoga;
            this._state = YogaLoadingState.READY;
            console.log('YogaService: WASM loaded successfully from UMD script.');
            return this._yoga;
          } else {
            throw new Error('Yoga not found in global scope after loading UMD script');
          }
        }
        
        // Для ES модуля получаем экспорт
        const yogaExport = yogaModule.default || yogaModule;
        
        if (typeof yogaExport === 'function') {
          this._yoga = await yogaExport();
        } else {
          this._yoga = yogaExport;
        }

        this._state = YogaLoadingState.READY;
        console.log('YogaService: WASM loaded successfully from ES module.');
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