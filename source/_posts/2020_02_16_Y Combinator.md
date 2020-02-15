---
title: Y Combinator
date: 2020-02-16 00:00:00
tags:
  - 函数式编程
---

用 JS 从零推导 Y 组合子

- <!--more-->


## 前置知识

### Lambda Calculus

如果你还不了解 Lambda 演算，可以先阅读 [Good Math/Bad Math](http://goodmath.blogspot.com/) Lambda Calculus 的系列文章。

#### Lambda Calculus Syntax

- Function definition
- Identifier reference
- Function application

为了降低理解门槛，我在以下使用 JS 的匿名函数语法，注意这和标准的 Lambda Calculus Syntax 有一定区别。

#### Lambda Calculus Evaluation Rules

- Alpha Conversion

```js
// 修改 lambda 表达式的参数和全部参照不会改变表达式的含义
// 简单的说就是以下两个 lambda 表达式是相等的
const f1 = x => x + x
const f2 = y => y + y
```

- Beta Reduction

```js
// 如果你有一个 function application（函数应用，在 JS 等价于调用这个函数）
// 你可以对这个函数体中和对应函数标识符相关的部分做替换，替换方法是把标识符用参数值替换
// 即以下两个 lambda 表达式是相等的
const f1 = (x => x + 1)(3)
const f2 = 3 + 1

// 更复杂的例子
const f3 = ((x, y) => x(y))(z => z * z, 3)
const f4 =  x => 3 * 3
```

## What's Y Combinator

纯正的 lambda 表达式是没有命名的，因此无法简单地通过函数名调用自身进行递归。
Y 组合子类似一个高阶函数，通过参数名来引用函数，进而巧妙地在不命名的情况下实现递归。
这次的目的就是推导这个高阶函数。

## λ Y

```js
// 这是一个普通的实现阶乘的递归函数
fact = n => (n === 1 ? 1 : n * fact(n - 1))
fact(5) // 120

// ---

// 但是上面地递归函数使用了 fact 这个命名
// 我们把 fact 转换成函数参数
fact = (f, n) => (n === 1 ? 1 : n * f(f, n - 1))
fact(fact, 5) // 120
// 这样函数的内部就没有 fact 这个命名了
// 缺点是调用时仍然需要使用命名

// 进一步地，我们在调用的时候使用 Beta 规约直接把 fact 这个函数替换成函数体
// 这样我们就可以在不使用函数命名的情况下使用一个需要递归的阶乘函数
;((f, n) => (n === 1 ? 1 : n * f(f, n - 1)))(
  (f, n) => (n === 1 ? 1 : n * f(f, n - 1)),
  5
) // 120

// ---

// 试着抽取函数参数
// fact = (f, n) => (n === 1 ? 1 : n * f(f, n - 1))
// Currying ->
fact = f => n => n === 1 ? 1 : n * f(f)(n - 1)
fact(fact)(5) // 120

// 将上面的步骤柯里化为一个参数之后得到了
// 穷人的 Y 组合子
;(f => n => n === 1 ? 1 : n * f(f)(n - 1))(
  f => n => n === 1 ? 1 : n * f(f)(n - 1)
)(5) // 120
// 但是这个 Y 组合子用起来相当不方便，你需要自己根据不同函数重复两遍相同的代码
// 因此我们需要继续抽象


// 首先需要把不通用的阶乘内容抽出
// 看到阶乘的穷人组合子中间有 f(f) 的形式
w = f => f(f)
w(f => n => n === 1 ? 1 : n * f(f)(n - 1)) (5) // w(fact)(5) 120
// 还原 w
;(f => f(f))(f => n => n === 1 ? 1 : n * f(f)(n - 1)) (5) // (f => f(f))(fact)(5) 120

// ---
// 查看阶乘内容的部分存在 f(f)
f => n => n === 1 ? 1 : n * f(f)(n - 1)
g = f(f) // Uncaught ReferenceError: f is not defined
f => (g => n => n === 1 ? 1 : n * g(n - 1)) (f(f))
// η-变换 v => f(f)(v) 可以等价于 f(f)
f => (g => n => n === 1 ? 1 : n * g(n - 1)) (v => f(f)(v))

// 这样一来可以看到一个干净的阶乘函数
fact0 = f => n => n === 1 ? 1 : n * f(n - 1)

// 把 fact0 的部分抽出到外部
;(fact0 => f => fact0(v => f(f)(v)))(
  g => n => n === 1 ? 1 : n * g(n - 1)
)

// -----
// 还原其他部分
w(
  (fact0 => f => fact0(v => f(f)(v)))
  (g => n => n === 1 ? 1 : n * g(n - 1))
)(5)

// 还原 w 为 f => f(f)
;(f => f(f))(
  (fact0 => f => fact0 (v => f(f)(v)))
  (g => n => n === 1 ? 1 : n * g(n - 1))
)(5) // 120

// 把阶乘的函数体替换为参数 h
h => (f => f(f)) ((fact0 => f => fact0(v => f(f)(v))) (h))

// 试着使用一下
;(h => (f => f(f))(
  (fact0 => f => fact0 (v => f(f)(v)))(h)
)) (g => n => n === 1 ? 1 : n * g(n - 1)) (5) // 120

// 终于得到了未简化版的
// Y Combinator
Y = h => (f => f(f))(
  (s => f => s(v => f(f)(v))) (h)
)

// apply h
Y = h =>
  (f => f(f))(
    f => h(v => f(f)(v))
  )

// apply to f => f(f)
// 简化完成
Y = h =>
  (f => h(v => f(f)(v)))
  (f => h(v => f(f)(v)))

// 试着使用一下
fact = f => n => n === 1 ? 1 : n * f(n - 1)
// 简单正确
factorial = Y(fact)
factorial(5) // 120

```

## 完成

最终我们就实现了一个帮助函数实现递归的高阶函数

```js
// Final Y Combinator
const Y = (h =>
  (f => h(v => f(f)(v)))
  (f => h(v => f(f)(v)))
)
```

## Bibliography

- [为什么是Y？](https://cgnail.github.io/academic/lambda-4/)
- [重新发明 Y 组合子 JavaScript(ES6) 版](http://picasso250.github.io/2015/03/31/reinvent-y.html)
- [简明Lambda算子介绍](http://www.unicornsummer.com/blog/2014-08/lambda.html)
- [康托尔、哥德尔、图灵——永恒的金色对角线](http://mindhacks.cn/2006/10/15/cantor-godel-turing-an-eternal-golden-diagonal/)
