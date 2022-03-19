import { Store, MutationPayload } from "vuex";
import merge from "deepmerge";
import * as shvl from "shvl";

interface Storage {
  getItem: (key: string) => any;
  setItem: (key: string, value: any) => void;
  removeItem: (key: string) => void;
}

interface Options<State> {
  key?: string;
  paths?: string[];
  reducer?: (state: State, paths: string[]) => object;
  subscriber?: (
    store: Store<State>
    ) => (handler: (mutation: any, state: State) => void) => void;
  storage?: Storage;
  getState?: (key: string, storage: Storage) => any;
  setState?: (key: string, state: any, storage: Storage) => void;
  filter?: (mutation: MutationPayload) => boolean;
  arrayMerger?: (state: any[], saved: any[]) => any;
  rehydrated?: (store: Store<State>) => void;
  fetchBeforeUse?: boolean;
  overwrite?: boolean;
  assertStorage?: (storage: Storage) => void | Error;
}


/*
  export default new Vuex.Store({
  // ...
  plugins: [
    persistedState({
      storage: {
        getItem: key => Cookies.get(key),
        setItem: (key, value) => Cookies.set(key, value, { expires: 7 }),
        removeItem: key => Cookies.remove(key)
      }
    })
  ]
})

export default function <State>(  options?: Options<State> ): (store: Store<State>) => void {} （下面表述为A函数）
===> 这是一个函数，且在 plugins，使用的 persistedState( options ) 进行配置。则在 vuex 的 store.js 文件中
****************************************************************
    //应用 Vuex.Store( { plugins: [ xxxx, xxx ] } ) 中注册的插件。
    plugins.forEach((plugin) => plugin(this));
****************************************************************
此时 plugin 是 A 函数执行之后的返回值，该返回值也是个函数。所以 A 函数接受的参数是 options，而 A 函数的返回结果对应的函数，接受的参数是 store.


options 的可用配置：
{
  key: "", //表示 state 是存在 localstorage 的哪个属性 key 之下。默认用 "vuex"
  storage: {  //用于操作存储的对象。默认用 window.localstorage。

  },
  getState(key, storage){}, //用于获取state的函数。第一个参数是存储 state 的key。第一个参数是存储对象。默认内置了getstate(){}
  overwrite: boolean, //如果为true，则存储的state，覆盖 store._vm.data.$$state; 如果为false。则与原来的 state 合并属性再替换。
  subscriber:(store)=>{}，
  filter: ({ type, payload })=>{}, 当指定type的commit调用时，是否要对改变的state进行存储。默认是true。
  path: 表示只存储 state 一部分的数据对应的路径。
}
*/
export default function <State>(  options?: Options<State> ): (store: Store<State>) => void {
  options = options || {};

  //如果 options 中传入了 storage 存储对象，就直接获取；否则在浏览器环境下就使用 window.localstorage
  const storage = options.storage || (window && window.localStorage);
  //在 localstorage 中的存储 key。
  const key = options.key || "vuex";

  function getState(key, storage) {
    //获取 storage 中存储 key 对应的数据 value。
    const value = storage.getItem(key);

    try {
      //如果 value 是字符串，则反序列化处理。
      //如果 value 是object,则返回obhect。
      //如果 value 是基础类型，返回undefined。
      return (typeof value === "string")
        ? JSON.parse(value) : (typeof value === "object")
        ? value : undefined;
    } catch (err) {}

    return undefined;
  }

  function filter() {
    return true;
  }

  //将数据设置到 storage 中； key 是存储路径，state是存储数据。
  function setState(key, state, storage) {
    //会将数据序列化成为字符串。
    return storage.setItem(key, JSON.stringify(state));
  }
  
  
  /**
   * state 是 store.state,
   * path  就是指定子 module 的路径数组。
   */
  function reducer(state, paths) {
    //如果 path 不是数组，那么就直接取 root state.
    return Array.isArray(paths)
      // 假如 path 为 ["user", "info", "name"]
      // 第一步：{ "user": { "info": {"name": "mengze", "name1": "mengze1"}, "info1":{ "name": "1111" } } } 
      // 第二步：{ "user": { "info": {"name": "mengze", "name1": "mengze1"}, "info1":{ "name": "1111" } }, "info":undefined } 
      // 第三步：{ "user": { "info": {"name": "mengze", "name1": "mengze1"}, "info1":{ "name": "1111" } }, "info":undefined, "name": undefined } 
      ? paths.reduce(function (substate, path) {
          return shvl.set(substate, path, shvl.get(state, path));
        }, {})
      : state;
  }

  /**
   *  获取一个观察者函数，调用该函数的时，会增加 commit 事件的订阅，且当 commit 事件发生时，会回调 handler。
   */
  function subscriber(store) {
    return function (handler) {
      //用于订阅 vuex 中的 commit 事件，当调用了 this.$store.commit(xxx)，handler就会被回调。
      return store.subscribe(handler);
    };
  }


  //如果options中配置了 assertStorage,则用传入的 assertStorage. 否则用内置的判断函数。
  const assertStorage =
    options.assertStorage ||
    //默认用于判断 storage 是否可用的函数。
    (() => {
      storage.setItem("@@", 1);
      storage.removeItem("@@");
    });

  //用于断言 storage 实例是否可用  
  assertStorage(storage);
  
  //查询已经保存的 state 数据。
  //options.getState 表示是外部传入的 getState 方法；如果外部没有配置 getState，则使用默认内置的 getState.
  //如果是默认的 getState, 则是根据 options.key 或者 ‘vuex’ 来获取已经存储的 state 数据。
  const fetchSavedState = () => (options.getState || getState)(key, storage);

  //用于保存 state。
  let savedState;
   
  //如果配置了在使用之前查询 state 的配置属性 fetchBeforeUse， 那么就直接获取已经存储的 state。
  if (options.fetchBeforeUse) {
    //获取 state 数据。
    savedState = fetchSavedState();
  }


  /**
   *  这个函数，就是下面的 plugin。接受的参数是 store 。在 store 实例创建的时候就会执行该函数。
   * ****************************************************************
        应用 Vuex.Store( { plugins: [ xxxx, xxx ] } ) 中注册的插件。
        plugins.forEach((plugin) => plugin(this));
    ****************************************************************
   */
  return function (store: Store<State>) {
    //如果没有配置使用前获取 state；则在插件创建的时候再获取 state 数据。
    if (!options.fetchBeforeUse) {
      //获取 localstorage 对象以 key 存储的 state。
      savedState = fetchSavedState();
    }

    //如果 savedState 是一个不为null的对象。
    if (typeof savedState === "object" && savedState !== null) {
      // store.replaceState 用于更新当前 store._vm.data.$$state 属性。
      //*****************************
      // replaceState(state) {
      //   在comit环境下替换。即 store._committing 为true 的上下文环境。
      //   this._withCommit(() => {
      //     this._vm._data.$$state = state;
      //   });
      // }
      //*****************************
      store.replaceState(
        //overwrite 是否覆盖
        options.overwrite
        //如果是覆盖，则丢弃旧的 store._vm.data.$$state 属性。
          ? savedState
          //进行合并,如果是对象，则深度合并；如果合并的属性是数组，则获取 savedState 中的数组作为合并结果。
          : merge(store.state, savedState, {
              arrayMerge:
                options.arrayMerger ||
                function (store, saved) {
                  return saved;
                },
              //如果clone为false，那么子对象将会被直接拷贝，而不是克隆。  
              //在 deepMerge 2.x 以上版本是默认行为。
              clone: false,
            })
      );

      //没看懂是干啥了，没用过；貌似给一个生命周期的回调。此时 store._vm.data.$$state 刚被替换成新元素。
      (options.rehydrated || function () {})(store);
    }

/**************** 上面的执行过程就是在 store 创建时，从 localstorage 中获取存储数据之后，更新 store._vm.data.$$state 属性。 *********************** */


/**************** 下面是利用 commit 的订阅队列， store.subscribe(cb) 函数调用时就会增加一个订阅。从而存储每次 state 的更新。 *********************** */
    // (options.subscriber || subscriber) 调用，则会新增对 commit 事件的订阅。
    (options.subscriber || subscriber)(store)(function (mutation, state) {
      //第一个参数：mutation 不是个函数，而是一个对象。 { type, payload }.
      //第二个参数：state 则是 store.state.

      //如果 filter 函数存在，则调用该 filter 函数。且如果 filter 返回 true，则 进入 if 代码块中。
      if ((options.filter || filter)(mutation)) {
        //如果存在 setState，则使用 key
        (options.setState || setState)(
          //序列化存储的key。
          key,
          //要存储的对象，如果paths为空，则直接存储state；如果paths不为空，则只存储paths对应的state的数据。
          /**
           * 1、如果 options.paths 有指定，则只存储 paths 对应的 state 中的数据。以 “vuex” 为 key 将数据存储的 localstorage 中。
           * 2、但是在 store 创建的时候，会获取的数据是 paths 对应的那部分数据，且会更新为整个 store._vm.data.$$state 对象。
           */
          (options.reducer || reducer)(state, options.paths),
          //存储对象
          storage
        );
      }
    });
  };
}
