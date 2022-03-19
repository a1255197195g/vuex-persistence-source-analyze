// const merge = require("deepmerge");

// const foobar = { foo: { bar: 3 }, test: [1, 2, 3] };
// const foobaz = { foo: { baz: 4 }, test: [4, 5, 3] };

// let result = merge(foobar, foobaz);
// console.log(result);

// result = merge(foobar, foobaz, {
//   arrayMerge: (params1, params2) => {
//     console.log("params1: ");
//     console.log(params1);
//     console.log("params2:");
//     console.log(params2);
//     return params2;
//   },
// });
// console.log(result);

const shvl = require("shvl");

/**
 * state 是 store.state,
 * path  就是指定子 module 的路径数组。
 */
function reducer(state, paths) {
  //如果 path 不是数组，那么就直接取 root state.
  return Array.isArray(paths)
    ? // 假如 path 为 ["user", "info", "name"]
      // 第一步：{ "user": User实例 }
      // 第二步：{ "user": { info: Info实例 } }
      paths.reduce(function (substate, path) {
        console.log(`${path} - ${JSON.stringify(shvl.get(state, path))}`);
        return shvl.set(substate, path, shvl.get(state, path));
      }, {})
    : state;
}

let state = {
  user: {
    info: {
      name: "111",
      name2: "222",
    },
    info1: {
      name: "222",
      name2: "333",
    },
  },
  user1: {
    info1: {},
  },
};

let path = ["user", "info", "name"];
let result = reducer(state, path);
console.log(result);
