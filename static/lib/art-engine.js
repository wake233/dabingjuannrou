/* Listen Paint Art Engine v4 — bundled at 2026-06-14T09:28:57.127Z */

// node_modules/d3-shape/src/constant.js
function constant_default(x3) {
  return function() {
    return x3;
  };
}

// node_modules/d3-shape/src/math.js
var epsilon = 1e-12, pi = Math.PI, halfPi = pi / 2, tau = 2 * pi;

// node_modules/d3-path/src/path.js
var pi2 = Math.PI, tau2 = 2 * pi2, epsilon2 = 1e-6, tauEpsilon = tau2 - epsilon2;
function append(strings) {
  this._ += strings[0];
  for (let i2 = 1, n2 = strings.length; i2 < n2; ++i2)
    this._ += arguments[i2] + strings[i2];
}
function appendRound(digits2) {
  let d2 = Math.floor(digits2);
  if (!(d2 >= 0)) throw new Error(`invalid digits: ${digits2}`);
  if (d2 > 15) return append;
  let k5 = 10 ** d2;
  return function(strings) {
    this._ += strings[0];
    for (let i2 = 1, n2 = strings.length; i2 < n2; ++i2)
      this._ += Math.round(arguments[i2] * k5) / k5 + strings[i2];
  };
}
var Path = class {
  constructor(digits2) {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null, this._ = "", this._append = digits2 == null ? append : appendRound(digits2);
  }
  moveTo(x3, y3) {
    this._append`M${this._x0 = this._x1 = +x3},${this._y0 = this._y1 = +y3}`;
  }
  closePath() {
    this._x1 !== null && (this._x1 = this._x0, this._y1 = this._y0, this._append`Z`);
  }
  lineTo(x3, y3) {
    this._append`L${this._x1 = +x3},${this._y1 = +y3}`;
  }
  quadraticCurveTo(x1, y1, x3, y3) {
    this._append`Q${+x1},${+y1},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  bezierCurveTo(x1, y1, x22, y22, x3, y3) {
    this._append`C${+x1},${+y1},${+x22},${+y22},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  arcTo(x1, y1, x22, y22, r3) {
    if (x1 = +x1, y1 = +y1, x22 = +x22, y22 = +y22, r3 = +r3, r3 < 0) throw new Error(`negative radius: ${r3}`);
    let x0 = this._x1, y0 = this._y1, x21 = x22 - x1, y21 = y22 - y1, x01 = x0 - x1, y01 = y0 - y1, l01_2 = x01 * x01 + y01 * y01;
    if (this._x1 === null)
      this._append`M${this._x1 = x1},${this._y1 = y1}`;
    else if (l01_2 > epsilon2) if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon2) || !r3)
      this._append`L${this._x1 = x1},${this._y1 = y1}`;
    else {
      let x20 = x22 - x0, y20 = y22 - y0, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l2 = r3 * Math.tan((pi2 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l2 / l01, t21 = l2 / l21;
      Math.abs(t01 - 1) > epsilon2 && this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`, this._append`A${r3},${r3},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
    }
  }
  arc(x3, y3, r3, a0, a1, ccw) {
    if (x3 = +x3, y3 = +y3, r3 = +r3, ccw = !!ccw, r3 < 0) throw new Error(`negative radius: ${r3}`);
    let dx = r3 * Math.cos(a0), dy = r3 * Math.sin(a0), x0 = x3 + dx, y0 = y3 + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
    this._x1 === null ? this._append`M${x0},${y0}` : (Math.abs(this._x1 - x0) > epsilon2 || Math.abs(this._y1 - y0) > epsilon2) && this._append`L${x0},${y0}`, r3 && (da < 0 && (da = da % tau2 + tau2), da > tauEpsilon ? this._append`A${r3},${r3},0,1,${cw},${x3 - dx},${y3 - dy}A${r3},${r3},0,1,${cw},${this._x1 = x0},${this._y1 = y0}` : da > epsilon2 && this._append`A${r3},${r3},0,${+(da >= pi2)},${cw},${this._x1 = x3 + r3 * Math.cos(a1)},${this._y1 = y3 + r3 * Math.sin(a1)}`);
  }
  rect(x3, y3, w2, h2) {
    this._append`M${this._x0 = this._x1 = +x3},${this._y0 = this._y1 = +y3}h${w2 = +w2}v${+h2}h${-w2}Z`;
  }
  toString() {
    return this._;
  }
};
function path() {
  return new Path();
}
path.prototype = Path.prototype;

// node_modules/d3-shape/src/path.js
function withPath(shape) {
  let digits2 = 3;
  return shape.digits = function(_2) {
    if (!arguments.length) return digits2;
    if (_2 == null)
      digits2 = null;
    else {
      let d2 = Math.floor(_2);
      if (!(d2 >= 0)) throw new RangeError(`invalid digits: ${_2}`);
      digits2 = d2;
    }
    return shape;
  }, () => new Path(digits2);
}

// node_modules/d3-shape/src/array.js
var slice = Array.prototype.slice;
function array_default(x3) {
  return typeof x3 == "object" && "length" in x3 ? x3 : Array.from(x3);
}

// node_modules/d3-shape/src/curve/linear.js
function Linear(context) {
  this._context = context;
}
Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    (this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    switch (x3 = +x3, y3 = +y3, this._point) {
      case 0:
        this._point = 1, this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
      // falls through
      default:
        this._context.lineTo(x3, y3);
        break;
    }
  }
};
function linear_default(context) {
  return new Linear(context);
}

// node_modules/d3-shape/src/point.js
function x(p4) {
  return p4[0];
}
function y(p4) {
  return p4[1];
}

// node_modules/d3-shape/src/line.js
function line_default(x3, y3) {
  var defined = constant_default(!0), context = null, curve = linear_default, output = null, path2 = withPath(line);
  x3 = typeof x3 == "function" ? x3 : x3 === void 0 ? x : constant_default(x3), y3 = typeof y3 == "function" ? y3 : y3 === void 0 ? y : constant_default(y3);
  function line(data) {
    var i2, n2 = (data = array_default(data)).length, d2, defined0 = !1, buffer;
    for (context == null && (output = curve(buffer = path2())), i2 = 0; i2 <= n2; ++i2)
      !(i2 < n2 && defined(d2 = data[i2], i2, data)) === defined0 && ((defined0 = !defined0) ? output.lineStart() : output.lineEnd()), defined0 && output.point(+x3(d2, i2, data), +y3(d2, i2, data));
    if (buffer) return output = null, buffer + "" || null;
  }
  return line.x = function(_2) {
    return arguments.length ? (x3 = typeof _2 == "function" ? _2 : constant_default(+_2), line) : x3;
  }, line.y = function(_2) {
    return arguments.length ? (y3 = typeof _2 == "function" ? _2 : constant_default(+_2), line) : y3;
  }, line.defined = function(_2) {
    return arguments.length ? (defined = typeof _2 == "function" ? _2 : constant_default(!!_2), line) : defined;
  }, line.curve = function(_2) {
    return arguments.length ? (curve = _2, context != null && (output = curve(context)), line) : curve;
  }, line.context = function(_2) {
    return arguments.length ? (_2 == null ? context = output = null : output = curve(context = _2), line) : context;
  }, line;
}

// node_modules/d3-shape/src/area.js
function area_default(x0, y0, y1) {
  var x1 = null, defined = constant_default(!0), context = null, curve = linear_default, output = null, path2 = withPath(area);
  x0 = typeof x0 == "function" ? x0 : x0 === void 0 ? x : constant_default(+x0), y0 = typeof y0 == "function" ? y0 : y0 === void 0 ? constant_default(0) : constant_default(+y0), y1 = typeof y1 == "function" ? y1 : y1 === void 0 ? y : constant_default(+y1);
  function area(data) {
    var i2, j2, k5, n2 = (data = array_default(data)).length, d2, defined0 = !1, buffer, x0z = new Array(n2), y0z = new Array(n2);
    for (context == null && (output = curve(buffer = path2())), i2 = 0; i2 <= n2; ++i2) {
      if (!(i2 < n2 && defined(d2 = data[i2], i2, data)) === defined0)
        if (defined0 = !defined0)
          j2 = i2, output.areaStart(), output.lineStart();
        else {
          for (output.lineEnd(), output.lineStart(), k5 = i2 - 1; k5 >= j2; --k5)
            output.point(x0z[k5], y0z[k5]);
          output.lineEnd(), output.areaEnd();
        }
      defined0 && (x0z[i2] = +x0(d2, i2, data), y0z[i2] = +y0(d2, i2, data), output.point(x1 ? +x1(d2, i2, data) : x0z[i2], y1 ? +y1(d2, i2, data) : y0z[i2]));
    }
    if (buffer) return output = null, buffer + "" || null;
  }
  function arealine() {
    return line_default().defined(defined).curve(curve).context(context);
  }
  return area.x = function(_2) {
    return arguments.length ? (x0 = typeof _2 == "function" ? _2 : constant_default(+_2), x1 = null, area) : x0;
  }, area.x0 = function(_2) {
    return arguments.length ? (x0 = typeof _2 == "function" ? _2 : constant_default(+_2), area) : x0;
  }, area.x1 = function(_2) {
    return arguments.length ? (x1 = _2 == null ? null : typeof _2 == "function" ? _2 : constant_default(+_2), area) : x1;
  }, area.y = function(_2) {
    return arguments.length ? (y0 = typeof _2 == "function" ? _2 : constant_default(+_2), y1 = null, area) : y0;
  }, area.y0 = function(_2) {
    return arguments.length ? (y0 = typeof _2 == "function" ? _2 : constant_default(+_2), area) : y0;
  }, area.y1 = function(_2) {
    return arguments.length ? (y1 = _2 == null ? null : typeof _2 == "function" ? _2 : constant_default(+_2), area) : y1;
  }, area.lineX0 = area.lineY0 = function() {
    return arealine().x(x0).y(y0);
  }, area.lineY1 = function() {
    return arealine().x(x0).y(y1);
  }, area.lineX1 = function() {
    return arealine().x(x1).y(y0);
  }, area.defined = function(_2) {
    return arguments.length ? (defined = typeof _2 == "function" ? _2 : constant_default(!!_2), area) : defined;
  }, area.curve = function(_2) {
    return arguments.length ? (curve = _2, context != null && (output = curve(context)), area) : curve;
  }, area.context = function(_2) {
    return arguments.length ? (_2 == null ? context = output = null : output = curve(context = _2), area) : context;
  }, area;
}

// node_modules/d3-shape/src/curve/cardinal.js
function point(that, x3, y3) {
  that._context.bezierCurveTo(
    that._x1 + that._k * (that._x2 - that._x0),
    that._y1 + that._k * (that._y2 - that._y0),
    that._x2 + that._k * (that._x1 - x3),
    that._y2 + that._k * (that._y1 - y3),
    that._x2,
    that._y2
  );
}
function Cardinal(context, tension) {
  this._context = context, this._k = (1 - tension) / 6;
}
Cardinal.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x2, this._y2);
        break;
      case 3:
        point(this, this._x1, this._y1);
        break;
    }
    (this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    switch (x3 = +x3, y3 = +y3, this._point) {
      case 0:
        this._point = 1, this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2, this._x1 = x3, this._y1 = y3;
        break;
      case 2:
        this._point = 3;
      // falls through
      default:
        point(this, x3, y3);
        break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3, this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var cardinal_default = (function custom(tension) {
  function cardinal(context) {
    return new Cardinal(context, tension);
  }
  return cardinal.tension = function(tension2) {
    return custom(+tension2);
  }, cardinal;
})(0);

// node_modules/d3-shape/src/curve/catmullRom.js
function point2(that, x3, y3) {
  var x1 = that._x1, y1 = that._y1, x22 = that._x2, y22 = that._y2;
  if (that._l01_a > epsilon) {
    var a2 = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a, n2 = 3 * that._l01_a * (that._l01_a + that._l12_a);
    x1 = (x1 * a2 - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n2, y1 = (y1 * a2 - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n2;
  }
  if (that._l23_a > epsilon) {
    var b2 = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a, m2 = 3 * that._l23_a * (that._l23_a + that._l12_a);
    x22 = (x22 * b2 + that._x1 * that._l23_2a - x3 * that._l12_2a) / m2, y22 = (y22 * b2 + that._y1 * that._l23_2a - y3 * that._l12_2a) / m2;
  }
  that._context.bezierCurveTo(x1, y1, x22, y22, that._x2, that._y2);
}
function CatmullRom(context, alpha) {
  this._context = context, this._alpha = alpha;
}
CatmullRom.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN, this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2:
        this._context.lineTo(this._x2, this._y2);
        break;
      case 3:
        this.point(this._x2, this._y2);
        break;
    }
    (this._line || this._line !== 0 && this._point === 1) && this._context.closePath(), this._line = 1 - this._line;
  },
  point: function(x3, y3) {
    if (x3 = +x3, y3 = +y3, this._point) {
      var x23 = this._x2 - x3, y23 = this._y2 - y3;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }
    switch (this._point) {
      case 0:
        this._point = 1, this._line ? this._context.lineTo(x3, y3) : this._context.moveTo(x3, y3);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
      // falls through
      default:
        point2(this, x3, y3);
        break;
    }
    this._l01_a = this._l12_a, this._l12_a = this._l23_a, this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a, this._x0 = this._x1, this._x1 = this._x2, this._x2 = x3, this._y0 = this._y1, this._y1 = this._y2, this._y2 = y3;
  }
};
var catmullRom_default = (function custom2(alpha) {
  function catmullRom(context) {
    return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
  }
  return catmullRom.alpha = function(alpha2) {
    return custom2(+alpha2);
  }, catmullRom;
})(0.5);

// node_modules/d3-shape/src/curve/natural.js
function Natural(context) {
  this._context = context;
}
Natural.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x = [], this._y = [];
  },
  lineEnd: function() {
    var x3 = this._x, y3 = this._y, n2 = x3.length;
    if (n2)
      if (this._line ? this._context.lineTo(x3[0], y3[0]) : this._context.moveTo(x3[0], y3[0]), n2 === 2)
        this._context.lineTo(x3[1], y3[1]);
      else
        for (var px = controlPoints(x3), py = controlPoints(y3), i0 = 0, i1 = 1; i1 < n2; ++i0, ++i1)
          this._context.bezierCurveTo(px[0][i0], py[0][i0], px[1][i0], py[1][i0], x3[i1], y3[i1]);
    (this._line || this._line !== 0 && n2 === 1) && this._context.closePath(), this._line = 1 - this._line, this._x = this._y = null;
  },
  point: function(x3, y3) {
    this._x.push(+x3), this._y.push(+y3);
  }
};
function controlPoints(x3) {
  var i2, n2 = x3.length - 1, m2, a2 = new Array(n2), b2 = new Array(n2), r3 = new Array(n2);
  for (a2[0] = 0, b2[0] = 2, r3[0] = x3[0] + 2 * x3[1], i2 = 1; i2 < n2 - 1; ++i2) a2[i2] = 1, b2[i2] = 4, r3[i2] = 4 * x3[i2] + 2 * x3[i2 + 1];
  for (a2[n2 - 1] = 2, b2[n2 - 1] = 7, r3[n2 - 1] = 8 * x3[n2 - 1] + x3[n2], i2 = 1; i2 < n2; ++i2) m2 = a2[i2] / b2[i2 - 1], b2[i2] -= m2, r3[i2] -= m2 * r3[i2 - 1];
  for (a2[n2 - 1] = r3[n2 - 1] / b2[n2 - 1], i2 = n2 - 2; i2 >= 0; --i2) a2[i2] = (r3[i2] - a2[i2 + 1]) / b2[i2];
  for (b2[n2 - 1] = (x3[n2] + a2[n2 - 1]) / 2, i2 = 0; i2 < n2 - 1; ++i2) b2[i2] = 2 * x3[i2 + 1] - a2[i2 + 1];
  return [a2, b2];
}
function natural_default(context) {
  return new Natural(context);
}

// node_modules/bezier-js/src/utils.js
var { abs, cos, sin, acos, atan2, sqrt, pow } = Math;
function crt(v2) {
  return v2 < 0 ? -pow(-v2, 1 / 3) : pow(v2, 1 / 3);
}
var pi3 = Math.PI, tau3 = 2 * pi3, quart = pi3 / 2, epsilon3 = 1e-6, nMax = Number.MAX_SAFE_INTEGER || 9007199254740991, nMin = Number.MIN_SAFE_INTEGER || -9007199254740991, ZERO = { x: 0, y: 0, z: 0 }, utils = {
  // Legendre-Gauss abscissae with n=24 (x_i values, defined at i=n as the roots of the nth order Legendre polynomial Pn(x))
  Tvalues: [
    -0.06405689286260563,
    0.06405689286260563,
    -0.1911188674736163,
    0.1911188674736163,
    -0.3150426796961634,
    0.3150426796961634,
    -0.4337935076260451,
    0.4337935076260451,
    -0.5454214713888396,
    0.5454214713888396,
    -0.6480936519369755,
    0.6480936519369755,
    -0.7401241915785544,
    0.7401241915785544,
    -0.820001985973903,
    0.820001985973903,
    -0.8864155270044011,
    0.8864155270044011,
    -0.9382745520027328,
    0.9382745520027328,
    -0.9747285559713095,
    0.9747285559713095,
    -0.9951872199970213,
    0.9951872199970213
  ],
  // Legendre-Gauss weights with n=24 (w_i values, defined by a function linked to in the Bezier primer article)
  Cvalues: [
    0.12793819534675216,
    0.12793819534675216,
    0.1258374563468283,
    0.1258374563468283,
    0.12167047292780339,
    0.12167047292780339,
    0.1155056680537256,
    0.1155056680537256,
    0.10744427011596563,
    0.10744427011596563,
    0.09761865210411388,
    0.09761865210411388,
    0.08619016153195327,
    0.08619016153195327,
    0.0733464814110803,
    0.0733464814110803,
    0.05929858491543678,
    0.05929858491543678,
    0.04427743881741981,
    0.04427743881741981,
    0.028531388628933663,
    0.028531388628933663,
    0.0123412297999872,
    0.0123412297999872
  ],
  arcfn: function(t3, derivativeFn) {
    let d2 = derivativeFn(t3), l2 = d2.x * d2.x + d2.y * d2.y;
    return typeof d2.z < "u" && (l2 += d2.z * d2.z), sqrt(l2);
  },
  compute: function(t3, points, _3d) {
    if (t3 === 0)
      return points[0].t = 0, points[0];
    let order = points.length - 1;
    if (t3 === 1)
      return points[order].t = 1, points[order];
    let mt = 1 - t3, p4 = points;
    if (order === 0)
      return points[0].t = t3, points[0];
    if (order === 1) {
      let ret = {
        x: mt * p4[0].x + t3 * p4[1].x,
        y: mt * p4[0].y + t3 * p4[1].y,
        t: t3
      };
      return _3d && (ret.z = mt * p4[0].z + t3 * p4[1].z), ret;
    }
    if (order < 4) {
      let mt2 = mt * mt, t22 = t3 * t3, a2, b2, c3, d2 = 0;
      order === 2 ? (p4 = [p4[0], p4[1], p4[2], ZERO], a2 = mt2, b2 = mt * t3 * 2, c3 = t22) : order === 3 && (a2 = mt2 * mt, b2 = mt2 * t3 * 3, c3 = mt * t22 * 3, d2 = t3 * t22);
      let ret = {
        x: a2 * p4[0].x + b2 * p4[1].x + c3 * p4[2].x + d2 * p4[3].x,
        y: a2 * p4[0].y + b2 * p4[1].y + c3 * p4[2].y + d2 * p4[3].y,
        t: t3
      };
      return _3d && (ret.z = a2 * p4[0].z + b2 * p4[1].z + c3 * p4[2].z + d2 * p4[3].z), ret;
    }
    let dCpts = JSON.parse(JSON.stringify(points));
    for (; dCpts.length > 1; ) {
      for (let i2 = 0; i2 < dCpts.length - 1; i2++)
        dCpts[i2] = {
          x: dCpts[i2].x + (dCpts[i2 + 1].x - dCpts[i2].x) * t3,
          y: dCpts[i2].y + (dCpts[i2 + 1].y - dCpts[i2].y) * t3
        }, typeof dCpts[i2].z < "u" && (dCpts[i2].z = dCpts[i2].z + (dCpts[i2 + 1].z - dCpts[i2].z) * t3);
      dCpts.splice(dCpts.length - 1, 1);
    }
    return dCpts[0].t = t3, dCpts[0];
  },
  computeWithRatios: function(t3, points, ratios, _3d) {
    let mt = 1 - t3, r3 = ratios, p4 = points, f1 = r3[0], f22 = r3[1], f32 = r3[2], f4 = r3[3], d2;
    if (f1 *= mt, f22 *= t3, p4.length === 2)
      return d2 = f1 + f22, {
        x: (f1 * p4[0].x + f22 * p4[1].x) / d2,
        y: (f1 * p4[0].y + f22 * p4[1].y) / d2,
        z: _3d ? (f1 * p4[0].z + f22 * p4[1].z) / d2 : !1,
        t: t3
      };
    if (f1 *= mt, f22 *= 2 * mt, f32 *= t3 * t3, p4.length === 3)
      return d2 = f1 + f22 + f32, {
        x: (f1 * p4[0].x + f22 * p4[1].x + f32 * p4[2].x) / d2,
        y: (f1 * p4[0].y + f22 * p4[1].y + f32 * p4[2].y) / d2,
        z: _3d ? (f1 * p4[0].z + f22 * p4[1].z + f32 * p4[2].z) / d2 : !1,
        t: t3
      };
    if (f1 *= mt, f22 *= 1.5 * mt, f32 *= 3 * mt, f4 *= t3 * t3 * t3, p4.length === 4)
      return d2 = f1 + f22 + f32 + f4, {
        x: (f1 * p4[0].x + f22 * p4[1].x + f32 * p4[2].x + f4 * p4[3].x) / d2,
        y: (f1 * p4[0].y + f22 * p4[1].y + f32 * p4[2].y + f4 * p4[3].y) / d2,
        z: _3d ? (f1 * p4[0].z + f22 * p4[1].z + f32 * p4[2].z + f4 * p4[3].z) / d2 : !1,
        t: t3
      };
  },
  derive: function(points, _3d) {
    let dpoints = [];
    for (let p4 = points, d2 = p4.length, c3 = d2 - 1; d2 > 1; d2--, c3--) {
      let list = [];
      for (let j2 = 0, dpt; j2 < c3; j2++)
        dpt = {
          x: c3 * (p4[j2 + 1].x - p4[j2].x),
          y: c3 * (p4[j2 + 1].y - p4[j2].y)
        }, _3d && (dpt.z = c3 * (p4[j2 + 1].z - p4[j2].z)), list.push(dpt);
      dpoints.push(list), p4 = list;
    }
    return dpoints;
  },
  between: function(v2, m2, M3) {
    return m2 <= v2 && v2 <= M3 || utils.approximately(v2, m2) || utils.approximately(v2, M3);
  },
  approximately: function(a2, b2, precision) {
    return abs(a2 - b2) <= (precision || epsilon3);
  },
  length: function(derivativeFn) {
    let len = utils.Tvalues.length, sum = 0;
    for (let i2 = 0, t3; i2 < len; i2++)
      t3 = 0.5 * utils.Tvalues[i2] + 0.5, sum += utils.Cvalues[i2] * utils.arcfn(t3, derivativeFn);
    return 0.5 * sum;
  },
  map: function(v2, ds, de, ts, te2) {
    let d1 = de - ds, d2 = te2 - ts, v22 = v2 - ds, r3 = v22 / d1;
    return ts + d2 * r3;
  },
  lerp: function(r3, v1, v2) {
    let ret = {
      x: v1.x + r3 * (v2.x - v1.x),
      y: v1.y + r3 * (v2.y - v1.y)
    };
    return v1.z !== void 0 && v2.z !== void 0 && (ret.z = v1.z + r3 * (v2.z - v1.z)), ret;
  },
  pointToString: function(p4) {
    let s2 = p4.x + "/" + p4.y;
    return typeof p4.z < "u" && (s2 += "/" + p4.z), s2;
  },
  pointsToString: function(points) {
    return "[" + points.map(utils.pointToString).join(", ") + "]";
  },
  copy: function(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  angle: function(o2, v1, v2) {
    let dx1 = v1.x - o2.x, dy1 = v1.y - o2.y, dx2 = v2.x - o2.x, dy2 = v2.y - o2.y, cross = dx1 * dy2 - dy1 * dx2, dot = dx1 * dx2 + dy1 * dy2;
    return atan2(cross, dot);
  },
  // round as string, to avoid rounding errors
  round: function(v2, d2) {
    let s2 = "" + v2, pos = s2.indexOf(".");
    return parseFloat(s2.substring(0, pos + 1 + d2));
  },
  dist: function(p1, p22) {
    let dx = p1.x - p22.x, dy = p1.y - p22.y;
    return sqrt(dx * dx + dy * dy);
  },
  closest: function(LUT, point3) {
    let mdist = pow(2, 63), mpos, d2;
    return LUT.forEach(function(p4, idx) {
      d2 = utils.dist(point3, p4), d2 < mdist && (mdist = d2, mpos = idx);
    }), { mdist, mpos };
  },
  abcratio: function(t3, n2) {
    if (n2 !== 2 && n2 !== 3)
      return !1;
    if (typeof t3 > "u")
      t3 = 0.5;
    else if (t3 === 0 || t3 === 1)
      return t3;
    let bottom = pow(t3, n2) + pow(1 - t3, n2), top = bottom - 1;
    return abs(top / bottom);
  },
  projectionratio: function(t3, n2) {
    if (n2 !== 2 && n2 !== 3)
      return !1;
    if (typeof t3 > "u")
      t3 = 0.5;
    else if (t3 === 0 || t3 === 1)
      return t3;
    let top = pow(1 - t3, n2), bottom = pow(t3, n2) + top;
    return top / bottom;
  },
  lli8: function(x1, y1, x22, y22, x3, y3, x4, y4) {
    let nx = (x1 * y22 - y1 * x22) * (x3 - x4) - (x1 - x22) * (x3 * y4 - y3 * x4), ny = (x1 * y22 - y1 * x22) * (y3 - y4) - (y1 - y22) * (x3 * y4 - y3 * x4), d2 = (x1 - x22) * (y3 - y4) - (y1 - y22) * (x3 - x4);
    return d2 == 0 ? !1 : { x: nx / d2, y: ny / d2 };
  },
  lli4: function(p1, p22, p33, p4) {
    let x1 = p1.x, y1 = p1.y, x22 = p22.x, y22 = p22.y, x3 = p33.x, y3 = p33.y, x4 = p4.x, y4 = p4.y;
    return utils.lli8(x1, y1, x22, y22, x3, y3, x4, y4);
  },
  lli: function(v1, v2) {
    return utils.lli4(v1, v1.c, v2, v2.c);
  },
  makeline: function(p1, p22) {
    return new Bezier(
      p1.x,
      p1.y,
      (p1.x + p22.x) / 2,
      (p1.y + p22.y) / 2,
      p22.x,
      p22.y
    );
  },
  findbbox: function(sections) {
    let mx = nMax, my = nMax, MX = nMin, MY = nMin;
    return sections.forEach(function(s2) {
      let bbox = s2.bbox();
      mx > bbox.x.min && (mx = bbox.x.min), my > bbox.y.min && (my = bbox.y.min), MX < bbox.x.max && (MX = bbox.x.max), MY < bbox.y.max && (MY = bbox.y.max);
    }), {
      x: { min: mx, mid: (mx + MX) / 2, max: MX, size: MX - mx },
      y: { min: my, mid: (my + MY) / 2, max: MY, size: MY - my }
    };
  },
  shapeintersections: function(s1, bbox1, s2, bbox2, curveIntersectionThreshold) {
    if (!utils.bboxoverlap(bbox1, bbox2)) return [];
    let intersections = [], a1 = [s1.startcap, s1.forward, s1.back, s1.endcap], a2 = [s2.startcap, s2.forward, s2.back, s2.endcap];
    return a1.forEach(function(l1) {
      l1.virtual || a2.forEach(function(l2) {
        if (l2.virtual) return;
        let iss = l1.intersects(l2, curveIntersectionThreshold);
        iss.length > 0 && (iss.c1 = l1, iss.c2 = l2, iss.s1 = s1, iss.s2 = s2, intersections.push(iss));
      });
    }), intersections;
  },
  makeshape: function(forward, back, curveIntersectionThreshold) {
    let bpl = back.points.length, fpl = forward.points.length, start = utils.makeline(back.points[bpl - 1], forward.points[0]), end = utils.makeline(forward.points[fpl - 1], back.points[0]), shape = {
      startcap: start,
      forward,
      back,
      endcap: end,
      bbox: utils.findbbox([start, forward, back, end])
    };
    return shape.intersections = function(s2) {
      return utils.shapeintersections(
        shape,
        shape.bbox,
        s2,
        s2.bbox,
        curveIntersectionThreshold
      );
    }, shape;
  },
  getminmax: function(curve, d2, list) {
    if (!list) return { min: 0, max: 0 };
    let min2 = nMax, max2 = nMin, t3, c3;
    list.indexOf(0) === -1 && (list = [0].concat(list)), list.indexOf(1) === -1 && list.push(1);
    for (let i2 = 0, len = list.length; i2 < len; i2++)
      t3 = list[i2], c3 = curve.get(t3), c3[d2] < min2 && (min2 = c3[d2]), c3[d2] > max2 && (max2 = c3[d2]);
    return { min: min2, mid: (min2 + max2) / 2, max: max2, size: max2 - min2 };
  },
  align: function(points, line) {
    let tx = line.p1.x, ty = line.p1.y, a2 = -atan2(line.p2.y - ty, line.p2.x - tx), d2 = function(v2) {
      return {
        x: (v2.x - tx) * cos(a2) - (v2.y - ty) * sin(a2),
        y: (v2.x - tx) * sin(a2) + (v2.y - ty) * cos(a2)
      };
    };
    return points.map(d2);
  },
  roots: function(points, line) {
    line = line || { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
    let order = points.length - 1, aligned = utils.align(points, line), reduce = function(t3) {
      return 0 <= t3 && t3 <= 1;
    };
    if (order === 2) {
      let a3 = aligned[0].y, b3 = aligned[1].y, c4 = aligned[2].y, d3 = a3 - 2 * b3 + c4;
      if (d3 !== 0) {
        let m1 = -sqrt(b3 * b3 - a3 * c4), m2 = -a3 + b3, v12 = -(m1 + m2) / d3, v2 = -(-m1 + m2) / d3;
        return [v12, v2].filter(reduce);
      } else if (b3 !== c4 && d3 === 0)
        return [(2 * b3 - c4) / (2 * b3 - 2 * c4)].filter(reduce);
      return [];
    }
    let pa = aligned[0].y, pb = aligned[1].y, pc = aligned[2].y, pd = aligned[3].y, d2 = -pa + 3 * pb - 3 * pc + pd, a2 = 3 * pa - 6 * pb + 3 * pc, b2 = -3 * pa + 3 * pb, c3 = pa;
    if (utils.approximately(d2, 0)) {
      if (utils.approximately(a2, 0))
        return utils.approximately(b2, 0) ? [] : [-c3 / b2].filter(reduce);
      let q3 = sqrt(b2 * b2 - 4 * a2 * c3), a22 = 2 * a2;
      return [(q3 - b2) / a22, (-b2 - q3) / a22].filter(reduce);
    }
    a2 /= d2, b2 /= d2, c3 /= d2;
    let p4 = (3 * b2 - a2 * a2) / 3, p33 = p4 / 3, q = (2 * a2 * a2 * a2 - 9 * a2 * b2 + 27 * c3) / 27, q2 = q / 2, discriminant = q2 * q2 + p33 * p33 * p33, u1, v1, x1, x22, x3;
    if (discriminant < 0) {
      let mp3 = -p4 / 3, mp33 = mp3 * mp3 * mp3, r3 = sqrt(mp33), t3 = -q / (2 * r3), cosphi = t3 < -1 ? -1 : t3 > 1 ? 1 : t3, phi = acos(cosphi), crtr = crt(r3), t1 = 2 * crtr;
      return x1 = t1 * cos(phi / 3) - a2 / 3, x22 = t1 * cos((phi + tau3) / 3) - a2 / 3, x3 = t1 * cos((phi + 2 * tau3) / 3) - a2 / 3, [x1, x22, x3].filter(reduce);
    } else {
      if (discriminant === 0)
        return u1 = q2 < 0 ? crt(-q2) : -crt(q2), x1 = 2 * u1 - a2 / 3, x22 = -u1 - a2 / 3, [x1, x22].filter(reduce);
      {
        let sd = sqrt(discriminant);
        return u1 = crt(-q2 + sd), v1 = crt(q2 + sd), [u1 - v1 - a2 / 3].filter(reduce);
      }
    }
  },
  droots: function(p4) {
    if (p4.length === 3) {
      let a2 = p4[0], b2 = p4[1], c3 = p4[2], d2 = a2 - 2 * b2 + c3;
      if (d2 !== 0) {
        let m1 = -sqrt(b2 * b2 - a2 * c3), m2 = -a2 + b2, v1 = -(m1 + m2) / d2, v2 = -(-m1 + m2) / d2;
        return [v1, v2];
      } else if (b2 !== c3 && d2 === 0)
        return [(2 * b2 - c3) / (2 * (b2 - c3))];
      return [];
    }
    if (p4.length === 2) {
      let a2 = p4[0], b2 = p4[1];
      return a2 !== b2 ? [a2 / (a2 - b2)] : [];
    }
    return [];
  },
  curvature: function(t3, d1, d2, _3d, kOnly) {
    let num3, dnm, adk, dk, k5 = 0, r3 = 0, d3 = utils.compute(t3, d1), dd = utils.compute(t3, d2), qdsum = d3.x * d3.x + d3.y * d3.y;
    if (_3d ? (num3 = sqrt(
      pow(d3.y * dd.z - dd.y * d3.z, 2) + pow(d3.z * dd.x - dd.z * d3.x, 2) + pow(d3.x * dd.y - dd.x * d3.y, 2)
    ), dnm = pow(qdsum + d3.z * d3.z, 3 / 2)) : (num3 = d3.x * dd.y - d3.y * dd.x, dnm = pow(qdsum, 3 / 2)), num3 === 0 || dnm === 0)
      return { k: 0, r: 0 };
    if (k5 = num3 / dnm, r3 = dnm / num3, !kOnly) {
      let pk = utils.curvature(t3 - 1e-3, d1, d2, _3d, !0).k, nk = utils.curvature(t3 + 1e-3, d1, d2, _3d, !0).k;
      dk = (nk - k5 + (k5 - pk)) / 2, adk = (abs(nk - k5) + abs(k5 - pk)) / 2;
    }
    return { k: k5, r: r3, dk, adk };
  },
  inflections: function(points) {
    if (points.length < 4) return [];
    let p4 = utils.align(points, { p1: points[0], p2: points.slice(-1)[0] }), a2 = p4[2].x * p4[1].y, b2 = p4[3].x * p4[1].y, c3 = p4[1].x * p4[2].y, d2 = p4[3].x * p4[2].y, v1 = 18 * (-3 * a2 + 2 * b2 + 3 * c3 - d2), v2 = 18 * (3 * a2 - b2 - 3 * c3), v3 = 18 * (c3 - a2);
    if (utils.approximately(v1, 0)) {
      if (!utils.approximately(v2, 0)) {
        let t3 = -v3 / v2;
        if (0 <= t3 && t3 <= 1) return [t3];
      }
      return [];
    }
    let d22 = 2 * v1;
    if (utils.approximately(d22, 0)) return [];
    let trm = v2 * v2 - 4 * v1 * v3;
    if (trm < 0) return [];
    let sq = Math.sqrt(trm);
    return [(sq - v2) / d22, -(v2 + sq) / d22].filter(function(r3) {
      return 0 <= r3 && r3 <= 1;
    });
  },
  bboxoverlap: function(b1, b2) {
    let dims = ["x", "y"], len = dims.length;
    for (let i2 = 0, dim, l2, t3, d2; i2 < len; i2++)
      if (dim = dims[i2], l2 = b1[dim].mid, t3 = b2[dim].mid, d2 = (b1[dim].size + b2[dim].size) / 2, abs(l2 - t3) >= d2) return !1;
    return !0;
  },
  expandbox: function(bbox, _bbox) {
    _bbox.x.min < bbox.x.min && (bbox.x.min = _bbox.x.min), _bbox.y.min < bbox.y.min && (bbox.y.min = _bbox.y.min), _bbox.z && _bbox.z.min < bbox.z.min && (bbox.z.min = _bbox.z.min), _bbox.x.max > bbox.x.max && (bbox.x.max = _bbox.x.max), _bbox.y.max > bbox.y.max && (bbox.y.max = _bbox.y.max), _bbox.z && _bbox.z.max > bbox.z.max && (bbox.z.max = _bbox.z.max), bbox.x.mid = (bbox.x.min + bbox.x.max) / 2, bbox.y.mid = (bbox.y.min + bbox.y.max) / 2, bbox.z && (bbox.z.mid = (bbox.z.min + bbox.z.max) / 2), bbox.x.size = bbox.x.max - bbox.x.min, bbox.y.size = bbox.y.max - bbox.y.min, bbox.z && (bbox.z.size = bbox.z.max - bbox.z.min);
  },
  pairiteration: function(c1, c22, curveIntersectionThreshold) {
    let c1b = c1.bbox(), c2b = c22.bbox(), r3 = 1e5, threshold = curveIntersectionThreshold || 0.5;
    if (c1b.x.size + c1b.y.size < threshold && c2b.x.size + c2b.y.size < threshold)
      return [
        (r3 * (c1._t1 + c1._t2) / 2 | 0) / r3 + "/" + (r3 * (c22._t1 + c22._t2) / 2 | 0) / r3
      ];
    let cc1 = c1.split(0.5), cc2 = c22.split(0.5), pairs = [
      { left: cc1.left, right: cc2.left },
      { left: cc1.left, right: cc2.right },
      { left: cc1.right, right: cc2.right },
      { left: cc1.right, right: cc2.left }
    ];
    pairs = pairs.filter(function(pair) {
      return utils.bboxoverlap(pair.left.bbox(), pair.right.bbox());
    });
    let results = [];
    return pairs.length === 0 || (pairs.forEach(function(pair) {
      results = results.concat(
        utils.pairiteration(pair.left, pair.right, threshold)
      );
    }), results = results.filter(function(v2, i2) {
      return results.indexOf(v2) === i2;
    })), results;
  },
  getccenter: function(p1, p22, p33) {
    let dx1 = p22.x - p1.x, dy1 = p22.y - p1.y, dx2 = p33.x - p22.x, dy2 = p33.y - p22.y, dx1p = dx1 * cos(quart) - dy1 * sin(quart), dy1p = dx1 * sin(quart) + dy1 * cos(quart), dx2p = dx2 * cos(quart) - dy2 * sin(quart), dy2p = dx2 * sin(quart) + dy2 * cos(quart), mx1 = (p1.x + p22.x) / 2, my1 = (p1.y + p22.y) / 2, mx2 = (p22.x + p33.x) / 2, my2 = (p22.y + p33.y) / 2, mx1n = mx1 + dx1p, my1n = my1 + dy1p, mx2n = mx2 + dx2p, my2n = my2 + dy2p, arc = utils.lli8(mx1, my1, mx1n, my1n, mx2, my2, mx2n, my2n), r3 = utils.dist(arc, p1), s2 = atan2(p1.y - arc.y, p1.x - arc.x), m2 = atan2(p22.y - arc.y, p22.x - arc.x), e5 = atan2(p33.y - arc.y, p33.x - arc.x), _2;
    return s2 < e5 ? ((s2 > m2 || m2 > e5) && (s2 += tau3), s2 > e5 && (_2 = e5, e5 = s2, s2 = _2)) : e5 < m2 && m2 < s2 ? (_2 = e5, e5 = s2, s2 = _2) : e5 += tau3, arc.s = s2, arc.e = e5, arc.r = r3, arc;
  },
  numberSort: function(a2, b2) {
    return a2 - b2;
  }
};

// node_modules/bezier-js/src/poly-bezier.js
var PolyBezier = class _PolyBezier {
  constructor(curves) {
    this.curves = [], this._3d = !1, curves && (this.curves = curves, this._3d = this.curves[0]._3d);
  }
  valueOf() {
    return this.toString();
  }
  toString() {
    return "[" + this.curves.map(function(curve) {
      return utils.pointsToString(curve.points);
    }).join(", ") + "]";
  }
  addCurve(curve) {
    this.curves.push(curve), this._3d = this._3d || curve._3d;
  }
  length() {
    return this.curves.map(function(v2) {
      return v2.length();
    }).reduce(function(a2, b2) {
      return a2 + b2;
    });
  }
  curve(idx) {
    return this.curves[idx];
  }
  bbox() {
    let c3 = this.curves;
    for (var bbox = c3[0].bbox(), i2 = 1; i2 < c3.length; i2++)
      utils.expandbox(bbox, c3[i2].bbox());
    return bbox;
  }
  offset(d2) {
    let offset = [];
    return this.curves.forEach(function(v2) {
      offset.push(...v2.offset(d2));
    }), new _PolyBezier(offset);
  }
};

// node_modules/bezier-js/src/bezier.js
var { abs: abs2, min, max, cos: cos2, sin: sin2, acos: acos2, sqrt: sqrt2 } = Math, pi4 = Math.PI;
var Bezier = class _Bezier {
  constructor(coords) {
    let args = coords && coords.forEach ? coords : Array.from(arguments).slice(), coordlen = !1;
    if (typeof args[0] == "object") {
      coordlen = args.length;
      let newargs = [];
      args.forEach(function(point4) {
        ["x", "y", "z"].forEach(function(d2) {
          typeof point4[d2] < "u" && newargs.push(point4[d2]);
        });
      }), args = newargs;
    }
    let higher = !1, len = args.length;
    if (coordlen) {
      if (coordlen > 4) {
        if (arguments.length !== 1)
          throw new Error(
            "Only new Bezier(point[]) is accepted for 4th and higher order curves"
          );
        higher = !0;
      }
    } else if (len !== 6 && len !== 8 && len !== 9 && len !== 12 && arguments.length !== 1)
      throw new Error(
        "Only new Bezier(point[]) is accepted for 4th and higher order curves"
      );
    let _3d = this._3d = !higher && (len === 9 || len === 12) || coords && coords[0] && typeof coords[0].z < "u", points = this.points = [];
    for (let idx = 0, step = _3d ? 3 : 2; idx < len; idx += step) {
      var point3 = {
        x: args[idx],
        y: args[idx + 1]
      };
      _3d && (point3.z = args[idx + 2]), points.push(point3);
    }
    let order = this.order = points.length - 1, dims = this.dims = ["x", "y"];
    _3d && dims.push("z"), this.dimlen = dims.length;
    let aligned = utils.align(points, { p1: points[0], p2: points[order] }), baselength = utils.dist(points[0], points[order]);
    this._linear = aligned.reduce((t3, p4) => t3 + abs2(p4.y), 0) < baselength / 50, this._lut = [], this._t1 = 0, this._t2 = 1, this.update();
  }
  static quadraticFromPoints(p1, p22, p33, t3) {
    if (typeof t3 > "u" && (t3 = 0.5), t3 === 0)
      return new _Bezier(p22, p22, p33);
    if (t3 === 1)
      return new _Bezier(p1, p22, p22);
    let abc = _Bezier.getABC(2, p1, p22, p33, t3);
    return new _Bezier(p1, abc.A, p33);
  }
  static cubicFromPoints(S2, B, E2, t3, d1) {
    typeof t3 > "u" && (t3 = 0.5);
    let abc = _Bezier.getABC(3, S2, B, E2, t3);
    typeof d1 > "u" && (d1 = utils.dist(B, abc.C));
    let d2 = d1 * (1 - t3) / t3, selen = utils.dist(S2, E2), lx = (E2.x - S2.x) / selen, ly = (E2.y - S2.y) / selen, bx1 = d1 * lx, by1 = d1 * ly, bx2 = d2 * lx, by2 = d2 * ly, e1 = { x: B.x - bx1, y: B.y - by1 }, e22 = { x: B.x + bx2, y: B.y + by2 }, A2 = abc.A, v1 = { x: A2.x + (e1.x - A2.x) / (1 - t3), y: A2.y + (e1.y - A2.y) / (1 - t3) }, v2 = { x: A2.x + (e22.x - A2.x) / t3, y: A2.y + (e22.y - A2.y) / t3 }, nc1 = { x: S2.x + (v1.x - S2.x) / t3, y: S2.y + (v1.y - S2.y) / t3 }, nc2 = {
      x: E2.x + (v2.x - E2.x) / (1 - t3),
      y: E2.y + (v2.y - E2.y) / (1 - t3)
    };
    return new _Bezier(S2, nc1, nc2, E2);
  }
  static getUtils() {
    return utils;
  }
  getUtils() {
    return _Bezier.getUtils();
  }
  static get PolyBezier() {
    return PolyBezier;
  }
  valueOf() {
    return this.toString();
  }
  toString() {
    return utils.pointsToString(this.points);
  }
  toSVG() {
    if (this._3d) return !1;
    let p4 = this.points, x3 = p4[0].x, y3 = p4[0].y, s2 = ["M", x3, y3, this.order === 2 ? "Q" : "C"];
    for (let i2 = 1, last = p4.length; i2 < last; i2++)
      s2.push(p4[i2].x), s2.push(p4[i2].y);
    return s2.join(" ");
  }
  setRatios(ratios) {
    if (ratios.length !== this.points.length)
      throw new Error("incorrect number of ratio values");
    this.ratios = ratios, this._lut = [];
  }
  verify() {
    let print = this.coordDigest();
    print !== this._print && (this._print = print, this.update());
  }
  coordDigest() {
    return this.points.map(function(c3, pos) {
      return "" + pos + c3.x + c3.y + (c3.z ? c3.z : 0);
    }).join("");
  }
  update() {
    this._lut = [], this.dpoints = utils.derive(this.points, this._3d), this.computedirection();
  }
  computedirection() {
    let points = this.points, angle = utils.angle(points[0], points[this.order], points[1]);
    this.clockwise = angle > 0;
  }
  length() {
    return utils.length(this.derivative.bind(this));
  }
  static getABC(order = 2, S2, B, E2, t3 = 0.5) {
    let u2 = utils.projectionratio(t3, order), um = 1 - u2, C4 = {
      x: u2 * S2.x + um * E2.x,
      y: u2 * S2.y + um * E2.y
    }, s2 = utils.abcratio(t3, order);
    return { A: {
      x: B.x + (B.x - C4.x) / s2,
      y: B.y + (B.y - C4.y) / s2
    }, B, C: C4, S: S2, E: E2 };
  }
  getABC(t3, B) {
    B = B || this.get(t3);
    let S2 = this.points[0], E2 = this.points[this.order];
    return _Bezier.getABC(this.order, S2, B, E2, t3);
  }
  getLUT(steps) {
    if (this.verify(), steps = steps || 100, this._lut.length === steps + 1)
      return this._lut;
    this._lut = [], steps++, this._lut = [];
    for (let i2 = 0, p4, t3; i2 < steps; i2++)
      t3 = i2 / (steps - 1), p4 = this.compute(t3), p4.t = t3, this._lut.push(p4);
    return this._lut;
  }
  on(point3, error) {
    error = error || 5;
    let lut = this.getLUT(), hits = [];
    for (let i2 = 0, c3, t3 = 0; i2 < lut.length; i2++)
      c3 = lut[i2], utils.dist(c3, point3) < error && (hits.push(c3), t3 += i2 / lut.length);
    return hits.length ? t /= hits.length : !1;
  }
  project(point3) {
    let LUT = this.getLUT(), l2 = LUT.length - 1, closest = utils.closest(LUT, point3), mpos = closest.mpos, t1 = (mpos - 1) / l2, t22 = (mpos + 1) / l2, step = 0.1 / l2, mdist = closest.mdist, t3 = t1, ft = t3, p4;
    mdist += 1;
    for (let d2; t3 < t22 + step; t3 += step)
      p4 = this.compute(t3), d2 = utils.dist(point3, p4), d2 < mdist && (mdist = d2, ft = t3);
    return ft = ft < 0 ? 0 : ft > 1 ? 1 : ft, p4 = this.compute(ft), p4.t = ft, p4.d = mdist, p4;
  }
  get(t3) {
    return this.compute(t3);
  }
  point(idx) {
    return this.points[idx];
  }
  compute(t3) {
    return this.ratios ? utils.computeWithRatios(t3, this.points, this.ratios, this._3d) : utils.compute(t3, this.points, this._3d, this.ratios);
  }
  raise() {
    let p4 = this.points, np = [p4[0]], k5 = p4.length;
    for (let i2 = 1, pi5, pim; i2 < k5; i2++)
      pi5 = p4[i2], pim = p4[i2 - 1], np[i2] = {
        x: (k5 - i2) / k5 * pi5.x + i2 / k5 * pim.x,
        y: (k5 - i2) / k5 * pi5.y + i2 / k5 * pim.y
      };
    return np[k5] = p4[k5 - 1], new _Bezier(np);
  }
  derivative(t3) {
    return utils.compute(t3, this.dpoints[0], this._3d);
  }
  dderivative(t3) {
    return utils.compute(t3, this.dpoints[1], this._3d);
  }
  align() {
    let p4 = this.points;
    return new _Bezier(utils.align(p4, { p1: p4[0], p2: p4[p4.length - 1] }));
  }
  curvature(t3) {
    return utils.curvature(t3, this.dpoints[0], this.dpoints[1], this._3d);
  }
  inflections() {
    return utils.inflections(this.points);
  }
  normal(t3) {
    return this._3d ? this.__normal3(t3) : this.__normal2(t3);
  }
  __normal2(t3) {
    let d2 = this.derivative(t3), q = sqrt2(d2.x * d2.x + d2.y * d2.y);
    return { t: t3, x: -d2.y / q, y: d2.x / q };
  }
  __normal3(t3) {
    let r1 = this.derivative(t3), r22 = this.derivative(t3 + 0.01), q1 = sqrt2(r1.x * r1.x + r1.y * r1.y + r1.z * r1.z), q2 = sqrt2(r22.x * r22.x + r22.y * r22.y + r22.z * r22.z);
    r1.x /= q1, r1.y /= q1, r1.z /= q1, r22.x /= q2, r22.y /= q2, r22.z /= q2;
    let c3 = {
      x: r22.y * r1.z - r22.z * r1.y,
      y: r22.z * r1.x - r22.x * r1.z,
      z: r22.x * r1.y - r22.y * r1.x
    }, m2 = sqrt2(c3.x * c3.x + c3.y * c3.y + c3.z * c3.z);
    c3.x /= m2, c3.y /= m2, c3.z /= m2;
    let R2 = [
      c3.x * c3.x,
      c3.x * c3.y - c3.z,
      c3.x * c3.z + c3.y,
      c3.x * c3.y + c3.z,
      c3.y * c3.y,
      c3.y * c3.z - c3.x,
      c3.x * c3.z - c3.y,
      c3.y * c3.z + c3.x,
      c3.z * c3.z
    ];
    return {
      t: t3,
      x: R2[0] * r1.x + R2[1] * r1.y + R2[2] * r1.z,
      y: R2[3] * r1.x + R2[4] * r1.y + R2[5] * r1.z,
      z: R2[6] * r1.x + R2[7] * r1.y + R2[8] * r1.z
    };
  }
  hull(t3) {
    let p4 = this.points, _p = [], q = [], idx = 0;
    for (q[idx++] = p4[0], q[idx++] = p4[1], q[idx++] = p4[2], this.order === 3 && (q[idx++] = p4[3]); p4.length > 1; ) {
      _p = [];
      for (let i2 = 0, pt, l2 = p4.length - 1; i2 < l2; i2++)
        pt = utils.lerp(t3, p4[i2], p4[i2 + 1]), q[idx++] = pt, _p.push(pt);
      p4 = _p;
    }
    return q;
  }
  split(t1, t22) {
    if (t1 === 0 && t22)
      return this.split(t22).left;
    if (t22 === 1)
      return this.split(t1).right;
    let q = this.hull(t1), result = {
      left: this.order === 2 ? new _Bezier([q[0], q[3], q[5]]) : new _Bezier([q[0], q[4], q[7], q[9]]),
      right: this.order === 2 ? new _Bezier([q[5], q[4], q[2]]) : new _Bezier([q[9], q[8], q[6], q[3]]),
      span: q
    };
    return result.left._t1 = utils.map(0, 0, 1, this._t1, this._t2), result.left._t2 = utils.map(t1, 0, 1, this._t1, this._t2), result.right._t1 = utils.map(t1, 0, 1, this._t1, this._t2), result.right._t2 = utils.map(1, 0, 1, this._t1, this._t2), t22 ? (t22 = utils.map(t22, t1, 1, 0, 1), result.right.split(t22).left) : result;
  }
  extrema() {
    let result = {}, roots = [];
    return this.dims.forEach(
      function(dim) {
        let mfn = function(v2) {
          return v2[dim];
        }, p4 = this.dpoints[0].map(mfn);
        result[dim] = utils.droots(p4), this.order === 3 && (p4 = this.dpoints[1].map(mfn), result[dim] = result[dim].concat(utils.droots(p4))), result[dim] = result[dim].filter(function(t3) {
          return t3 >= 0 && t3 <= 1;
        }), roots = roots.concat(result[dim].sort(utils.numberSort));
      }.bind(this)
    ), result.values = roots.sort(utils.numberSort).filter(function(v2, idx) {
      return roots.indexOf(v2) === idx;
    }), result;
  }
  bbox() {
    let extrema = this.extrema(), result = {};
    return this.dims.forEach(
      function(d2) {
        result[d2] = utils.getminmax(this, d2, extrema[d2]);
      }.bind(this)
    ), result;
  }
  overlaps(curve) {
    let lbbox = this.bbox(), tbbox = curve.bbox();
    return utils.bboxoverlap(lbbox, tbbox);
  }
  offset(t3, d2) {
    if (typeof d2 < "u") {
      let c3 = this.get(t3), n2 = this.normal(t3), ret = {
        c: c3,
        n: n2,
        x: c3.x + n2.x * d2,
        y: c3.y + n2.y * d2
      };
      return this._3d && (ret.z = c3.z + n2.z * d2), ret;
    }
    if (this._linear) {
      let nv = this.normal(0), coords = this.points.map(function(p4) {
        let ret = {
          x: p4.x + t3 * nv.x,
          y: p4.y + t3 * nv.y
        };
        return p4.z && nv.z && (ret.z = p4.z + t3 * nv.z), ret;
      });
      return [new _Bezier(coords)];
    }
    return this.reduce().map(function(s2) {
      return s2._linear ? s2.offset(t3)[0] : s2.scale(t3);
    });
  }
  simple() {
    if (this.order === 3) {
      let a1 = utils.angle(this.points[0], this.points[3], this.points[1]), a2 = utils.angle(this.points[0], this.points[3], this.points[2]);
      if (a1 > 0 && a2 < 0 || a1 < 0 && a2 > 0) return !1;
    }
    let n1 = this.normal(0), n2 = this.normal(1), s2 = n1.x * n2.x + n1.y * n2.y;
    return this._3d && (s2 += n1.z * n2.z), abs2(acos2(s2)) < pi4 / 3;
  }
  reduce() {
    let i2, t1 = 0, t22 = 0, step = 0.01, segment, pass1 = [], pass2 = [], extrema = this.extrema().values;
    for (extrema.indexOf(0) === -1 && (extrema = [0].concat(extrema)), extrema.indexOf(1) === -1 && extrema.push(1), t1 = extrema[0], i2 = 1; i2 < extrema.length; i2++)
      t22 = extrema[i2], segment = this.split(t1, t22), segment._t1 = t1, segment._t2 = t22, pass1.push(segment), t1 = t22;
    return pass1.forEach(function(p1) {
      for (t1 = 0, t22 = 0; t22 <= 1; )
        for (t22 = t1 + step; t22 <= 1 + step; t22 += step)
          if (segment = p1.split(t1, t22), !segment.simple()) {
            if (t22 -= step, abs2(t1 - t22) < step)
              return [];
            segment = p1.split(t1, t22), segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2), segment._t2 = utils.map(t22, 0, 1, p1._t1, p1._t2), pass2.push(segment), t1 = t22;
            break;
          }
      t1 < 1 && (segment = p1.split(t1, 1), segment._t1 = utils.map(t1, 0, 1, p1._t1, p1._t2), segment._t2 = p1._t2, pass2.push(segment));
    }), pass2;
  }
  translate(v2, d1, d2) {
    d2 = typeof d2 == "number" ? d2 : d1;
    let o2 = this.order, d3 = this.points.map((_2, i2) => (1 - i2 / o2) * d1 + i2 / o2 * d2);
    return new _Bezier(
      this.points.map((p4, i2) => ({
        x: p4.x + v2.x * d3[i2],
        y: p4.y + v2.y * d3[i2]
      }))
    );
  }
  scale(d2) {
    let order = this.order, distanceFn = !1;
    if (typeof d2 == "function" && (distanceFn = d2), distanceFn && order === 2)
      return this.raise().scale(distanceFn);
    let clockwise = this.clockwise, points = this.points;
    if (this._linear)
      return this.translate(
        this.normal(0),
        distanceFn ? distanceFn(0) : d2,
        distanceFn ? distanceFn(1) : d2
      );
    let r1 = distanceFn ? distanceFn(0) : d2, r22 = distanceFn ? distanceFn(1) : d2, v2 = [this.offset(0, 10), this.offset(1, 10)], np = [], o2 = utils.lli4(v2[0], v2[0].c, v2[1], v2[1].c);
    if (!o2)
      throw new Error("cannot scale this curve. Try reducing it first.");
    return [0, 1].forEach(function(t3) {
      let p4 = np[t3 * order] = utils.copy(points[t3 * order]);
      p4.x += (t3 ? r22 : r1) * v2[t3].n.x, p4.y += (t3 ? r22 : r1) * v2[t3].n.y;
    }), distanceFn ? ([0, 1].forEach(function(t3) {
      if (!(order === 2 && t3)) {
        var p4 = points[t3 + 1], ov = {
          x: p4.x - o2.x,
          y: p4.y - o2.y
        }, rc = distanceFn ? distanceFn((t3 + 1) / order) : d2;
        distanceFn && !clockwise && (rc = -rc);
        var m2 = sqrt2(ov.x * ov.x + ov.y * ov.y);
        ov.x /= m2, ov.y /= m2, np[t3 + 1] = {
          x: p4.x + rc * ov.x,
          y: p4.y + rc * ov.y
        };
      }
    }), new _Bezier(np)) : ([0, 1].forEach((t3) => {
      if (order === 2 && t3) return;
      let p4 = np[t3 * order], d3 = this.derivative(t3), p22 = { x: p4.x + d3.x, y: p4.y + d3.y };
      np[t3 + 1] = utils.lli4(p4, p22, o2, points[t3 + 1]);
    }), new _Bezier(np));
  }
  outline(d1, d2, d3, d4) {
    if (d2 = d2 === void 0 ? d1 : d2, this._linear) {
      let n2 = this.normal(0), start = this.points[0], end = this.points[this.points.length - 1], s2, mid, e5;
      d3 === void 0 && (d3 = d1, d4 = d2), s2 = { x: start.x + n2.x * d1, y: start.y + n2.y * d1 }, e5 = { x: end.x + n2.x * d3, y: end.y + n2.y * d3 }, mid = { x: (s2.x + e5.x) / 2, y: (s2.y + e5.y) / 2 };
      let fline = [s2, mid, e5];
      s2 = { x: start.x - n2.x * d2, y: start.y - n2.y * d2 }, e5 = { x: end.x - n2.x * d4, y: end.y - n2.y * d4 }, mid = { x: (s2.x + e5.x) / 2, y: (s2.y + e5.y) / 2 };
      let bline = [e5, mid, s2], ls2 = utils.makeline(bline[2], fline[0]), le2 = utils.makeline(fline[2], bline[0]), segments2 = [ls2, new _Bezier(fline), le2, new _Bezier(bline)];
      return new PolyBezier(segments2);
    }
    let reduced = this.reduce(), len = reduced.length, fcurves = [], bcurves = [], p4, alen = 0, tlen = this.length(), graduated = typeof d3 < "u" && typeof d4 < "u";
    function linearDistanceFunction(s2, e5, tlen2, alen2, slen) {
      return function(v2) {
        let f1 = alen2 / tlen2, f22 = (alen2 + slen) / tlen2, d5 = e5 - s2;
        return utils.map(v2, 0, 1, s2 + f1 * d5, s2 + f22 * d5);
      };
    }
    reduced.forEach(function(segment) {
      let slen = segment.length();
      graduated ? (fcurves.push(
        segment.scale(linearDistanceFunction(d1, d3, tlen, alen, slen))
      ), bcurves.push(
        segment.scale(linearDistanceFunction(-d2, -d4, tlen, alen, slen))
      )) : (fcurves.push(segment.scale(d1)), bcurves.push(segment.scale(-d2))), alen += slen;
    }), bcurves = bcurves.map(function(s2) {
      return p4 = s2.points, p4[3] ? s2.points = [p4[3], p4[2], p4[1], p4[0]] : s2.points = [p4[2], p4[1], p4[0]], s2;
    }).reverse();
    let fs = fcurves[0].points[0], fe = fcurves[len - 1].points[fcurves[len - 1].points.length - 1], bs = bcurves[len - 1].points[bcurves[len - 1].points.length - 1], be = bcurves[0].points[0], ls = utils.makeline(bs, fs), le = utils.makeline(fe, be), segments = [ls].concat(fcurves).concat([le]).concat(bcurves);
    return new PolyBezier(segments);
  }
  outlineshapes(d1, d2, curveIntersectionThreshold) {
    d2 = d2 || d1;
    let outline = this.outline(d1, d2).curves, shapes = [];
    for (let i2 = 1, len = outline.length; i2 < len / 2; i2++) {
      let shape = utils.makeshape(
        outline[i2],
        outline[len - i2],
        curveIntersectionThreshold
      );
      shape.startcap.virtual = i2 > 1, shape.endcap.virtual = i2 < len / 2 - 1, shapes.push(shape);
    }
    return shapes;
  }
  intersects(curve, curveIntersectionThreshold) {
    return curve ? curve.p1 && curve.p2 ? this.lineIntersects(curve) : (curve instanceof _Bezier && (curve = curve.reduce()), this.curveintersects(
      this.reduce(),
      curve,
      curveIntersectionThreshold
    )) : this.selfintersects(curveIntersectionThreshold);
  }
  lineIntersects(line) {
    let mx = min(line.p1.x, line.p2.x), my = min(line.p1.y, line.p2.y), MX = max(line.p1.x, line.p2.x), MY = max(line.p1.y, line.p2.y);
    return utils.roots(this.points, line).filter((t3) => {
      var p4 = this.get(t3);
      return utils.between(p4.x, mx, MX) && utils.between(p4.y, my, MY);
    });
  }
  selfintersects(curveIntersectionThreshold) {
    let reduced = this.reduce(), len = reduced.length - 2, results = [];
    for (let i2 = 0, result, left, right; i2 < len; i2++)
      left = reduced.slice(i2, i2 + 1), right = reduced.slice(i2 + 2), result = this.curveintersects(left, right, curveIntersectionThreshold), results.push(...result);
    return results;
  }
  curveintersects(c1, c22, curveIntersectionThreshold) {
    let pairs = [];
    c1.forEach(function(l2) {
      c22.forEach(function(r3) {
        l2.overlaps(r3) && pairs.push({ left: l2, right: r3 });
      });
    });
    let intersections = [];
    return pairs.forEach(function(pair) {
      let result = utils.pairiteration(
        pair.left,
        pair.right,
        curveIntersectionThreshold
      );
      result.length > 0 && (intersections = intersections.concat(result));
    }), intersections;
  }
  arcs(errorThreshold) {
    return errorThreshold = errorThreshold || 0.5, this._iterate(errorThreshold, []);
  }
  _error(pc, np1, s2, e5) {
    let q = (e5 - s2) / 4, c1 = this.get(s2 + q), c22 = this.get(e5 - q), ref = utils.dist(pc, np1), d1 = utils.dist(pc, c1), d2 = utils.dist(pc, c22);
    return abs2(d1 - ref) + abs2(d2 - ref);
  }
  _iterate(errorThreshold, circles) {
    let t_s = 0, t_e = 1, safety;
    do {
      safety = 0, t_e = 1;
      let np1 = this.get(t_s), np2, np3, arc, prev_arc, curr_good = !1, prev_good = !1, done, t_m = t_e, prev_e = 1, step = 0;
      do
        if (prev_good = curr_good, prev_arc = arc, t_m = (t_s + t_e) / 2, step++, np2 = this.get(t_m), np3 = this.get(t_e), arc = utils.getccenter(np1, np2, np3), arc.interval = {
          start: t_s,
          end: t_e
        }, curr_good = this._error(arc, np1, t_s, t_e) <= errorThreshold, done = prev_good && !curr_good, done || (prev_e = t_e), curr_good) {
          if (t_e >= 1) {
            if (arc.interval.end = prev_e = 1, prev_arc = arc, t_e > 1) {
              let d2 = {
                x: arc.x + arc.r * cos2(arc.e),
                y: arc.y + arc.r * sin2(arc.e)
              };
              arc.e += utils.angle({ x: arc.x, y: arc.y }, d2, this.get(1));
            }
            break;
          }
          t_e = t_e + (t_e - t_s) / 2;
        } else
          t_e = t_m;
      while (!done && safety++ < 100);
      if (safety >= 100)
        break;
      prev_arc = prev_arc || arc, circles.push(prev_arc), t_s = prev_e;
    } while (t_e < 1);
    return circles;
  }
};

// lib/geometry.js
var COORD_BOUND = 1e5, MAX_CURVE_POINTS = 500;
function clampCoord(value) {
  return Number.isFinite(value) ? Math.max(-COORD_BOUND, Math.min(COORD_BOUND, value)) : 0;
}
function clampPoint([x3, y3]) {
  return [clampCoord(x3), clampCoord(y3)];
}
function clampPoints(points) {
  return points.map(clampPoint);
}
function organicCurve(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return [];
  let clamped = clampPoints(points), curveType = options.curve || "catmullRom", samples = Math.min(options.samples || 100, MAX_CURVE_POINTS), curveFn;
  switch (curveType) {
    case "natural":
      curveFn = natural_default;
      break;
    case "linear":
      curveFn = linear_default;
      break;
    default:
      curveFn = catmullRom_default;
  }
  let pathData = line_default().curve(curveFn)(clamped);
  if (!pathData) return [];
  let pts = [], re2 = /([ML])\s*([-\d.]+)\s*[,]\s*([-\d.]+)/g, match;
  for (; match = re2.exec(pathData); )
    pts.push([clampCoord(parseFloat(match[2])), clampCoord(parseFloat(match[3]))]);
  if (pts.length < 2 && clamped.length >= 2)
    for (let i2 = 0; i2 <= samples; i2++) {
      let t3 = i2 / samples, idx = Math.min(Math.floor(t3 * (clamped.length - 1)), clamped.length - 2), frac = t3 * (clamped.length - 1) - idx;
      pts.push([
        clampCoord(clamped[idx][0] + (clamped[idx + 1][0] - clamped[idx][0]) * frac),
        clampCoord(clamped[idx + 1][1] + (clamped[idx + 1][1] - clamped[idx][1]) * frac)
      ]);
    }
  return pts;
}
function organicContour(points) {
  if (!Array.isArray(points) || points.length < 3) return [];
  let clamped = clampPoints(points), areaGen = area_default().curve(catmullRom_default);
  return organicCurve([...clamped, clamped[0]], { curve: "catmullRom" });
}
function bezierSample(p0, p1, p22, p33, t3) {
  try {
    let pt = new Bezier(
      clampCoord(p0[0]),
      clampCoord(p0[1]),
      clampCoord(p1[0]),
      clampCoord(p1[1]),
      clampCoord(p22[0]),
      clampCoord(p22[1]),
      clampCoord(p33[0]),
      clampCoord(p33[1])
    ).get(t3);
    return [clampCoord(pt.x), clampCoord(pt.y)];
  } catch {
    let mt = 1 - t3;
    return [
      clampCoord(mt * mt * mt * p0[0] + 3 * mt * mt * t3 * p1[0] + 3 * mt * t3 * t3 * p22[0] + t3 * t3 * t3 * p33[0]),
      clampCoord(mt * mt * mt * p0[1] + 3 * mt * mt * t3 * p1[1] + 3 * mt * t3 * t3 * p22[1] + t3 * t3 * t3 * p33[1])
    ];
  }
}
function bezierSamples(p0, p1, p22, p33, samples = 50) {
  let n2 = Math.min(samples, MAX_CURVE_POINTS), result = [];
  for (let i2 = 0; i2 <= n2; i2++)
    result.push(bezierSample(p0, p1, p22, p33, i2 / n2));
  return result;
}
function bezierTangent(p0, p1, p22, p33, t3) {
  try {
    let d2 = new Bezier(
      clampCoord(p0[0]),
      clampCoord(p0[1]),
      clampCoord(p1[0]),
      clampCoord(p1[1]),
      clampCoord(p22[0]),
      clampCoord(p22[1]),
      clampCoord(p33[0]),
      clampCoord(p33[1])
    ).derivative(t3);
    return Math.atan2(d2.y, d2.x);
  } catch {
    return 0;
  }
}
function bezierOffset(p0, p1, p22, p33, distance) {
  try {
    let pts = new Bezier(
      clampCoord(p0[0]),
      clampCoord(p0[1]),
      clampCoord(p1[0]),
      clampCoord(p1[1]),
      clampCoord(p22[0]),
      clampCoord(p22[1]),
      clampCoord(p33[0]),
      clampCoord(p33[1])
    ).offset(distance).points;
    return {
      p0: [clampCoord(pts[0].x), clampCoord(pts[0].y)],
      p1: [clampCoord(pts[1].x), clampCoord(pts[1].y)],
      p2: [clampCoord(pts[2].x), clampCoord(pts[2].y)],
      p3: [clampCoord(pts[3].x), clampCoord(pts[3].y)]
    };
  } catch {
    return null;
  }
}
function bezierIntersections(p0a, p1a, p2a, p3a, p0b, p1b, p2b, p3b) {
  try {
    let b1 = new Bezier(
      clampCoord(p0a[0]),
      clampCoord(p0a[1]),
      clampCoord(p1a[0]),
      clampCoord(p1a[1]),
      clampCoord(p2a[0]),
      clampCoord(p2a[1]),
      clampCoord(p3a[0]),
      clampCoord(p3a[1])
    ), b2 = new Bezier(
      clampCoord(p0b[0]),
      clampCoord(p0b[1]),
      clampCoord(p1b[0]),
      clampCoord(p1b[1]),
      clampCoord(p2b[0]),
      clampCoord(p2b[1]),
      clampCoord(p3b[0]),
      clampCoord(p3b[1])
    );
    return b1.intersects(b2).map((t3) => {
      let pt = b1.get(t3);
      return [clampCoord(pt.x), clampCoord(pt.y)];
    });
  } catch {
    return [];
  }
}
function smoothPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return [];
  if (points.length === 2)
    return [points[0], points[1]];
  let clamped = clampPoints(points), result = [];
  for (let i2 = 0; i2 < clamped.length - 1; i2++) {
    let p0 = clamped[i2], p33 = clamped[i2 + 1], prev = clamped[Math.max(0, i2 - 1)], next = clamped[Math.min(clamped.length - 1, i2 + 2)], cp1 = [
      p0[0] + (p33[0] - prev[0]) / 6,
      p0[1] + (p33[1] - prev[1]) / 6
    ], cp2 = [
      p33[0] - (next[0] - p0[0]) / 6,
      p33[1] - (next[1] - p0[1]) / 6
    ], seg = bezierSamples(p0, cp1, cp2, p33, 20);
    i2 > 0 && seg.shift(), result.push(...seg);
  }
  return result;
}

// node_modules/perfect-freehand/dist/esm/index.mjs
var { PI: e } = Math, t2 = e + 1e-4, n = 0.5, r = [1, 1];
function i(e5, t3, n2, r3 = (e6) => e6) {
  return e5 * r3(0.5 - t3 * (0.5 - n2));
}
var { min: a } = Math;
function o(e5, t3, n2) {
  let r3 = a(1, t3 / n2);
  return a(1, e5 + (a(1, 1 - r3) - e5) * (r3 * 0.275));
}
function s(e5) {
  return [-e5[0], -e5[1]];
}
function c(e5, t3) {
  return [e5[0] + t3[0], e5[1] + t3[1]];
}
function l(e5, t3, n2) {
  return e5[0] = t3[0] + n2[0], e5[1] = t3[1] + n2[1], e5;
}
function u(e5, t3) {
  return [e5[0] - t3[0], e5[1] - t3[1]];
}
function d(e5, t3, n2) {
  return e5[0] = t3[0] - n2[0], e5[1] = t3[1] - n2[1], e5;
}
function f(e5, t3) {
  return [e5[0] * t3, e5[1] * t3];
}
function p(e5, t3, n2) {
  return e5[0] = t3[0] * n2, e5[1] = t3[1] * n2, e5;
}
function m(e5, t3) {
  return [e5[0] / t3, e5[1] / t3];
}
function h(e5) {
  return [e5[1], -e5[0]];
}
function g(e5, t3) {
  let n2 = t3[0];
  return e5[0] = t3[1], e5[1] = -n2, e5;
}
function ee(e5, t3) {
  return e5[0] * t3[0] + e5[1] * t3[1];
}
function _(e5, t3) {
  return e5[0] === t3[0] && e5[1] === t3[1];
}
function v(e5) {
  return Math.hypot(e5[0], e5[1]);
}
function y2(e5, t3) {
  let n2 = e5[0] - t3[0], r3 = e5[1] - t3[1];
  return n2 * n2 + r3 * r3;
}
function b(e5) {
  return m(e5, v(e5));
}
function x2(e5, t3) {
  return Math.hypot(e5[1] - t3[1], e5[0] - t3[0]);
}
function S(e5, t3, n2) {
  let r3 = Math.sin(n2), i2 = Math.cos(n2), a2 = e5[0] - t3[0], o2 = e5[1] - t3[1], s2 = a2 * i2 - o2 * r3, c3 = a2 * r3 + o2 * i2;
  return [s2 + t3[0], c3 + t3[1]];
}
function C(e5, t3, n2, r3) {
  let i2 = Math.sin(r3), a2 = Math.cos(r3), o2 = t3[0] - n2[0], s2 = t3[1] - n2[1], c3 = o2 * a2 - s2 * i2, l2 = o2 * i2 + s2 * a2;
  return e5[0] = c3 + n2[0], e5[1] = l2 + n2[1], e5;
}
function w(e5, t3, n2) {
  return c(e5, f(u(t3, e5), n2));
}
function te(e5, t3, n2, r3) {
  let i2 = n2[0] - t3[0], a2 = n2[1] - t3[1];
  return e5[0] = t3[0] + i2 * r3, e5[1] = t3[1] + a2 * r3, e5;
}
function T(e5, t3, n2) {
  return c(e5, f(t3, n2));
}
var E = [0, 0], D = [0, 0], O = [0, 0];
function k(e5, n2) {
  let r3 = T(e5, b(h(u(e5, c(e5, [1, 1])))), -n2), i2 = [], a2 = 1 / 13;
  for (let n3 = a2; n3 <= 1; n3 += a2) i2.push(S(r3, e5, t2 * 2 * n3));
  return i2;
}
function A(e5, n2, r3) {
  let i2 = [], a2 = 1 / r3;
  for (let r4 = a2; r4 <= 1; r4 += a2) i2.push(S(n2, e5, t2 * r4));
  return i2;
}
function j(e5, t3, n2) {
  let r3 = u(t3, n2), i2 = f(r3, 0.5), a2 = f(r3, 0.51);
  return [u(e5, i2), u(e5, a2), c(e5, a2), c(e5, i2)];
}
function M(e5, n2, r3, i2) {
  let a2 = [], o2 = T(e5, n2, r3), s2 = 1 / i2;
  for (let n3 = s2; n3 < 1; n3 += s2) a2.push(S(o2, e5, t2 * 3 * n3));
  return a2;
}
function ne(e5, t3, n2) {
  return [c(e5, f(t3, n2)), c(e5, f(t3, n2 * 0.99)), u(e5, f(t3, n2 * 0.99)), u(e5, f(t3, n2))];
}
function N(e5, t3, n2) {
  return e5 === !1 || e5 === void 0 ? 0 : e5 === !0 ? Math.max(t3, n2) : e5;
}
function re(e5, t3, n2) {
  return e5.slice(0, 10).reduce((e6, r3) => {
    let i2 = r3.pressure;
    return t3 && (i2 = o(e6, r3.distance, n2)), (e6 + i2) / 2;
  }, e5[0].pressure);
}
function P(e5, n2 = {}) {
  let { size: r3 = 16, smoothing: a2 = 0.5, thinning: f4 = 0.5, simulatePressure: m2 = !0, easing: _2 = (e6) => e6, start: v2 = {}, end: b2 = {}, last: x3 = !1 } = n2, { cap: S2 = !0, easing: w2 = (e6) => e6 * (2 - e6) } = v2, { cap: T2 = !0, easing: P2 = (e6) => --e6 * e6 * e6 + 1 } = b2;
  if (e5.length === 0 || r3 <= 0) return [];
  let F5 = e5[e5.length - 1].runningLength, I2 = N(v2.taper, r3, F5), L2 = N(b2.taper, r3, F5), R2 = (r3 * a2) ** 2, z = [], B = [], V = re(e5, m2, r3), H = i(r3, f4, e5[e5.length - 1].pressure, _2), U, W = e5[0].vector, G = e5[0].point, K = G, q = G, J = K, Y = !1;
  for (let n3 = 0; n3 < e5.length; n3++) {
    let { pressure: a3 } = e5[n3], { point: s2, vector: h2, distance: v3, runningLength: b3 } = e5[n3], x4 = n3 === e5.length - 1;
    if (!x4 && F5 - b3 < 3) continue;
    f4 ? (m2 && (a3 = o(V, v3, r3)), H = i(r3, f4, a3, _2)) : H = r3 / 2, U === void 0 && (U = H);
    let S3 = b3 < I2 ? w2(b3 / I2) : 1, T3 = F5 - b3 < L2 ? P2((F5 - b3) / L2) : 1;
    H = Math.max(0.01, H * Math.min(S3, T3));
    let k5 = (x4 ? e5[n3] : e5[n3 + 1]).vector, A2 = x4 ? 1 : ee(h2, k5), j2 = ee(h2, W) < 0 && !Y, M3 = A2 !== null && A2 < 0;
    if (j2 || M3) {
      g(E, W), p(E, E, H);
      for (let e6 = 0; e6 <= 1; e6 += 0.07692307692307693) d(D, s2, E), C(D, D, s2, t2 * e6), q = [D[0], D[1]], z.push(q), l(O, s2, E), C(O, O, s2, t2 * -e6), J = [O[0], O[1]], B.push(J);
      G = q, K = J, M3 && (Y = !0);
      continue;
    }
    if (Y = !1, x4) {
      g(E, h2), p(E, E, H), z.push(u(s2, E)), B.push(c(s2, E));
      continue;
    }
    te(E, k5, h2, A2), g(E, E), p(E, E, H), d(D, s2, E), q = [D[0], D[1]], (n3 <= 1 || y2(G, q) > R2) && (z.push(q), G = q), l(O, s2, E), J = [O[0], O[1]], (n3 <= 1 || y2(K, J) > R2) && (B.push(J), K = J), V = a3, W = h2;
  }
  let X = [e5[0].point[0], e5[0].point[1]], Z = e5.length > 1 ? [e5[e5.length - 1].point[0], e5[e5.length - 1].point[1]] : c(e5[0].point, [1, 1]), Q = [], $ = [];
  if (e5.length === 1) {
    if (!(I2 || L2) || x3) return k(X, U || H);
  } else {
    I2 || L2 && e5.length === 1 || (S2 ? Q.push(...A(X, B[0], 13)) : Q.push(...j(X, z[0], B[0])));
    let t3 = h(s(e5[e5.length - 1].vector));
    L2 || I2 && e5.length === 1 ? $.push(Z) : T2 ? $.push(...M(Z, t3, H, 29)) : $.push(...ne(Z, t3, H));
  }
  return z.concat($, B.reverse(), Q);
}
var F = [0, 0];
function I(e5) {
  return e5 != null && e5 >= 0;
}
function L(e5, t3 = {}) {
  let { streamline: i2 = 0.5, size: a2 = 16, last: o2 = !1 } = t3;
  if (e5.length === 0) return [];
  let s2 = 0.15 + (1 - i2) * 0.85, l2 = Array.isArray(e5[0]) ? e5 : e5.map(({ x: e6, y: t4, pressure: r3 = n }) => [e6, t4, r3]);
  if (l2.length === 2) {
    let e6 = l2[1];
    l2 = l2.slice(0, -1);
    for (let t4 = 1; t4 < 5; t4++) l2.push(w(l2[0], e6, t4 / 4));
  }
  l2.length === 1 && (l2 = [...l2, [...c(l2[0], r), ...l2[0].slice(2)]]);
  let u2 = [{ point: [l2[0][0], l2[0][1]], pressure: I(l2[0][2]) ? l2[0][2] : 0.25, vector: [...r], distance: 0, runningLength: 0 }], f4 = !1, p4 = 0, m2 = u2[0], h2 = l2.length - 1;
  for (let e6 = 1; e6 < l2.length; e6++) {
    let t4 = o2 && e6 === h2 ? [l2[e6][0], l2[e6][1]] : w(m2.point, l2[e6], s2);
    if (_(m2.point, t4)) continue;
    let r3 = x2(t4, m2.point);
    if (p4 += r3, e6 < h2 && !f4) {
      if (p4 < a2) continue;
      f4 = !0;
    }
    d(F, m2.point, t4), m2 = { point: t4, pressure: I(l2[e6][2]) ? l2[e6][2] : n, vector: b(F), distance: r3, runningLength: p4 }, u2.push(m2);
  }
  return u2[0].vector = u2[1]?.vector || [0, 0], u2;
}
function R(e5, t3 = {}) {
  return P(L(e5, t3), t3);
}

// lib/brush.js
var COORD_BOUND2 = 1e5;
var MAX_PATH_LENGTH = 12e3;
function clampC(v2) {
  return Number.isFinite(v2) ? Math.max(-COORD_BOUND2, Math.min(COORD_BOUND2, v2)) : 0;
}
function mulberry32(seed) {
  let state = Math.abs(Math.floor(seed * 2147483647)) | 0;
  return () => {
    state = state + 1831565813 | 0;
    let t3 = Math.imul(state ^ state >>> 15, 1 | state);
    return t3 = t3 + Math.imul(t3 ^ t3 >>> 7, 61 | t3) ^ t3, ((t3 ^ t3 >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s2) {
  let h2 = 0;
  for (let i2 = 0; i2 < s2.length; i2++)
    h2 = (h2 << 5) - h2 + s2.charCodeAt(i2) | 0;
  return Math.abs(h2) / 2147483648 % 1;
}
var DEFAULT_STROKE_OPTIONS = {
  size: 3.5,
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.5,
  taperStart: 0.15,
  taperEnd: 0.15,
  capStart: !0,
  capEnd: !0,
  simulatePressure: !0
};
function freehandStroke(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return "";
  let clamped = points.map(([x3, y3]) => [
    clampC(x3 || 0),
    clampC(y3 || 0)
  ]), seed = typeof options.seed == "number" ? options.seed : hashString(String(options.seed ?? "default")), rng = mulberry32(seed), strokeOpts = {
    ...DEFAULT_STROKE_OPTIONS,
    ...options,
    simulatePressure: !0
  }, withPressure = clamped.map(([x3, y3], i2) => {
    let t3 = i2 / Math.max(1, clamped.length - 1), basePressure = 0.4 + 0.6 * (1 - Math.abs(2 * t3 - 1)), jitter = (rng() - 0.5) * 0.3;
    return [x3, y3, Math.max(0.1, Math.min(1, basePressure + jitter))];
  });
  try {
    let stroke = R(withPressure, strokeOpts);
    if (!stroke || stroke.length < 3) return "";
    let d2 = "", nodeCount = 0;
    for (let i2 = 0; i2 < stroke.length && !(nodeCount >= MAX_PATH_LENGTH); i2++) {
      let [x3, y3] = stroke[i2];
      d2 += `${i2 === 0 ? "M" : "L"}${clampC(x3).toFixed(2)} ${clampC(y3).toFixed(2)}`, nodeCount++;
    }
    return options.closed && d2 && (d2 += " Z"), d2;
  } catch {
    return "";
  }
}
function freehandHatch(points, count = 8, spacing = 8, angle = 45, seed = "hatch") {
  if (!Array.isArray(points) || points.length < 2) return [];
  let numSeed = typeof seed == "number" ? seed : hashString(String(seed)), rng = mulberry32(numSeed + 1), rad = angle * Math.PI / 180, cos3 = Math.cos(rad), sin3 = Math.sin(rad), minX = Math.min(...points.map((p4) => p4[0])), maxX = Math.max(...points.map((p4) => p4[0])), minY = Math.min(...points.map((p4) => p4[1])), maxY = Math.max(...points.map((p4) => p4[1])), diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, lines = [];
  for (let i2 = 0; i2 < count; i2++) {
    let offset = (i2 - count / 2) * spacing + (rng() - 0.5) * spacing * 0.5, p1x = cx + cos3 * -diagonal + -sin3 * offset, p1y = cy + sin3 * -diagonal + cos3 * offset, p2x = cx + cos3 * diagonal + -sin3 * offset, p2y = cy + sin3 * diagonal + cos3 * offset, hatchSeed = numSeed + i2 * 100, d2 = freehandStroke(
      [[p1x, p1y], [p2x, p2y]],
      { size: 1.2, thinning: 0.4, smoothing: 0.3, taperStart: 0.1, taperEnd: 0.1, seed: hatchSeed }
    );
    d2 && lines.push(d2);
  }
  return lines;
}
function taperedBrushStroke(points, options = {}) {
  return freehandStroke(points, {
    ...options,
    taperStart: options.taperStart ?? 0.25,
    taperEnd: options.taperEnd ?? 0.25,
    thinning: options.thinning ?? 0.65
  });
}

// node_modules/culori/src/rgb/parseNumber.js
var parseNumber = (color, len) => {
  if (typeof color == "number") {
    if (len === 3)
      return {
        mode: "rgb",
        r: (color >> 8 & 15 | color >> 4 & 240) / 255,
        g: (color >> 4 & 15 | color & 240) / 255,
        b: (color & 15 | color << 4 & 240) / 255
      };
    if (len === 4)
      return {
        mode: "rgb",
        r: (color >> 12 & 15 | color >> 8 & 240) / 255,
        g: (color >> 8 & 15 | color >> 4 & 240) / 255,
        b: (color >> 4 & 15 | color & 240) / 255,
        alpha: (color & 15 | color << 4 & 240) / 255
      };
    if (len === 6)
      return {
        mode: "rgb",
        r: (color >> 16 & 255) / 255,
        g: (color >> 8 & 255) / 255,
        b: (color & 255) / 255
      };
    if (len === 8)
      return {
        mode: "rgb",
        r: (color >> 24 & 255) / 255,
        g: (color >> 16 & 255) / 255,
        b: (color >> 8 & 255) / 255,
        alpha: (color & 255) / 255
      };
  }
}, parseNumber_default = parseNumber;

// node_modules/culori/src/colors/named.js
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  // Added in CSS Colors Level 4:
  // https://drafts.csswg.org/css-color/#changes-from-3
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
}, named_default = named;

// node_modules/culori/src/rgb/parseNamed.js
var parseNamed = (color) => parseNumber_default(named_default[color.toLowerCase()], 6), parseNamed_default = parseNamed;

// node_modules/culori/src/rgb/parseHex.js
var hex = /^#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i, parseHex = (color) => {
  let match;
  return (match = color.match(hex)) ? parseNumber_default(parseInt(match[1], 16), match[1].length) : void 0;
}, parseHex_default = parseHex;

// node_modules/culori/src/util/regex.js
var num = "([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)", num_none = `(?:${num}|none)`, per = `${num}%`, per_none = `(?:${num}%|none)`, num_per = `(?:${num}%|${num})`, num_per_none = `(?:${num}%|${num}|none)`, hue = `(?:${num}(deg|grad|rad|turn)|${num})`, hue_none = `(?:${num}(deg|grad|rad|turn)|${num}|none)`, c2 = "\\s*,\\s*";
var rx_num_per_none = new RegExp("^" + num_per_none + "$");

// node_modules/culori/src/rgb/parseRgbLegacy.js
var rgb_num_old = new RegExp(
  `^rgba?\\(\\s*${num}${c2}${num}${c2}${num}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
), rgb_per_old = new RegExp(
  `^rgba?\\(\\s*${per}${c2}${per}${c2}${per}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
), parseRgbLegacy = (color) => {
  let res = { mode: "rgb" }, match;
  if (match = color.match(rgb_num_old))
    match[1] !== void 0 && (res.r = match[1] / 255), match[2] !== void 0 && (res.g = match[2] / 255), match[3] !== void 0 && (res.b = match[3] / 255);
  else if (match = color.match(rgb_per_old))
    match[1] !== void 0 && (res.r = match[1] / 100), match[2] !== void 0 && (res.g = match[2] / 100), match[3] !== void 0 && (res.b = match[3] / 100);
  else
    return;
  return match[4] !== void 0 ? res.alpha = Math.max(0, Math.min(1, match[4] / 100)) : match[5] !== void 0 && (res.alpha = Math.max(0, Math.min(1, +match[5]))), res;
}, parseRgbLegacy_default = parseRgbLegacy;

// node_modules/culori/src/_prepare.js
var prepare = (color, mode) => color === void 0 ? void 0 : typeof color != "object" ? parse_default(color) : color.mode !== void 0 ? color : mode ? { ...color, mode } : void 0, prepare_default = prepare;

// node_modules/culori/src/converter.js
var converter = (target_mode = "rgb") => (color) => (color = prepare_default(color, target_mode)) !== void 0 ? (
  // if the color's mode corresponds to our target mode
  color.mode === target_mode ? (
    // then just return the color
    color
  ) : (
    // otherwise check to see if we have a dedicated
    // converter for the target mode
    converters[color.mode][target_mode] ? (
      // and return its result...
      converters[color.mode][target_mode](color)
    ) : (
      // ...otherwise pass through RGB as an intermediary step.
      // if the target mode is RGB...
      target_mode === "rgb" ? (
        // just return the RGB
        converters[color.mode].rgb(color)
      ) : (
        // otherwise convert color.mode -> RGB -> target_mode
        converters.rgb[target_mode](converters[color.mode].rgb(color))
      )
    )
  )
) : void 0, converter_default = converter;

// node_modules/culori/src/modes.js
var converters = {}, modes = {}, parsers = [], colorProfiles = {}, identity = (v2) => v2, useMode = (definition29) => (converters[definition29.mode] = {
  ...converters[definition29.mode],
  ...definition29.toMode
}, Object.keys(definition29.fromMode || {}).forEach((k5) => {
  converters[k5] || (converters[k5] = {}), converters[k5][definition29.mode] = definition29.fromMode[k5];
}), definition29.ranges || (definition29.ranges = {}), definition29.difference || (definition29.difference = {}), definition29.channels.forEach((channel) => {
  if (definition29.ranges[channel] === void 0 && (definition29.ranges[channel] = [0, 1]), !definition29.interpolate[channel])
    throw new Error(`Missing interpolator for: ${channel}`);
  typeof definition29.interpolate[channel] == "function" && (definition29.interpolate[channel] = {
    use: definition29.interpolate[channel]
  }), definition29.interpolate[channel].fixup || (definition29.interpolate[channel].fixup = identity);
}), modes[definition29.mode] = definition29, (definition29.parse || []).forEach((parser) => {
  useParser(parser, definition29.mode);
}), converter_default(definition29.mode)), getMode = (mode) => modes[mode], useParser = (parser, mode) => {
  if (typeof parser == "string") {
    if (!mode)
      throw new Error("'mode' required when 'parser' is a string");
    colorProfiles[parser] = mode;
  } else typeof parser == "function" && parsers.indexOf(parser) < 0 && parsers.push(parser);
};

// node_modules/culori/src/parse.js
var IdentStartCodePoint = /[^\x00-\x7F]|[a-zA-Z_]/, IdentCodePoint = /[^\x00-\x7F]|[-\w]/, Tok = {
  Function: "function",
  Ident: "ident",
  Number: "number",
  Percentage: "percentage",
  ParenClose: ")",
  None: "none",
  Hue: "hue",
  Alpha: "alpha"
}, _i = 0;
function is_num(chars) {
  let ch = chars[_i], ch1 = chars[_i + 1];
  return ch === "-" || ch === "+" ? /\d/.test(ch1) || ch1 === "." && /\d/.test(chars[_i + 2]) : ch === "." ? /\d/.test(ch1) : /\d/.test(ch);
}
function is_ident(chars) {
  if (_i >= chars.length)
    return !1;
  let ch = chars[_i];
  if (IdentStartCodePoint.test(ch))
    return !0;
  if (ch === "-") {
    if (chars.length - _i < 2)
      return !1;
    let ch1 = chars[_i + 1];
    return !!(ch1 === "-" || IdentStartCodePoint.test(ch1));
  }
  return !1;
}
var huenits = {
  deg: 1,
  rad: 180 / Math.PI,
  grad: 9 / 10,
  turn: 360
};
function num2(chars) {
  let value = "";
  if ((chars[_i] === "-" || chars[_i] === "+") && (value += chars[_i++]), value += digits(chars), chars[_i] === "." && /\d/.test(chars[_i + 1]) && (value += chars[_i++] + digits(chars)), (chars[_i] === "e" || chars[_i] === "E") && ((chars[_i + 1] === "-" || chars[_i + 1] === "+") && /\d/.test(chars[_i + 2]) ? value += chars[_i++] + chars[_i++] + digits(chars) : /\d/.test(chars[_i + 1]) && (value += chars[_i++] + digits(chars))), is_ident(chars)) {
    let id = ident(chars);
    return id === "deg" || id === "rad" || id === "turn" || id === "grad" ? { type: Tok.Hue, value: value * huenits[id] } : void 0;
  }
  return chars[_i] === "%" ? (_i++, { type: Tok.Percentage, value: +value }) : { type: Tok.Number, value: +value };
}
function digits(chars) {
  let v2 = "";
  for (; /\d/.test(chars[_i]); )
    v2 += chars[_i++];
  return v2;
}
function ident(chars) {
  let v2 = "";
  for (; _i < chars.length && IdentCodePoint.test(chars[_i]); )
    v2 += chars[_i++];
  return v2;
}
function identlike(chars) {
  let v2 = ident(chars);
  return chars[_i] === "(" ? (_i++, { type: Tok.Function, value: v2 }) : v2 === "none" ? { type: Tok.None, value: void 0 } : { type: Tok.Ident, value: v2 };
}
function tokenize(str = "") {
  let chars = str.trim(), tokens = [], ch;
  for (_i = 0; _i < chars.length; ) {
    if (ch = chars[_i++], ch === `
` || ch === "	" || ch === " ") {
      for (; _i < chars.length && (chars[_i] === `
` || chars[_i] === "	" || chars[_i] === " "); )
        _i++;
      continue;
    }
    if (ch === ",")
      return;
    if (ch === ")") {
      tokens.push({ type: Tok.ParenClose });
      continue;
    }
    if (ch === "+") {
      if (_i--, is_num(chars)) {
        tokens.push(num2(chars));
        continue;
      }
      return;
    }
    if (ch === "-") {
      if (_i--, is_num(chars)) {
        tokens.push(num2(chars));
        continue;
      }
      if (is_ident(chars)) {
        tokens.push({ type: Tok.Ident, value: ident(chars) });
        continue;
      }
      return;
    }
    if (ch === ".") {
      if (_i--, is_num(chars)) {
        tokens.push(num2(chars));
        continue;
      }
      return;
    }
    if (ch === "/") {
      for (; _i < chars.length && (chars[_i] === `
` || chars[_i] === "	" || chars[_i] === " "); )
        _i++;
      let alpha;
      if (is_num(chars) && (alpha = num2(chars), alpha.type !== Tok.Hue)) {
        tokens.push({ type: Tok.Alpha, value: alpha });
        continue;
      }
      if (is_ident(chars) && ident(chars) === "none") {
        tokens.push({
          type: Tok.Alpha,
          value: { type: Tok.None, value: void 0 }
        });
        continue;
      }
      return;
    }
    if (/\d/.test(ch)) {
      _i--, tokens.push(num2(chars));
      continue;
    }
    if (IdentStartCodePoint.test(ch)) {
      _i--, tokens.push(identlike(chars));
      continue;
    }
    return;
  }
  return tokens;
}
function parseColorSyntax(tokens) {
  tokens._i = 0;
  let token = tokens[tokens._i++];
  if (!token || token.type !== Tok.Function || token.value !== "color" || (token = tokens[tokens._i++], token.type !== Tok.Ident))
    return;
  let mode = colorProfiles[token.value];
  if (!mode)
    return;
  let res = { mode }, coords = consumeCoords(tokens, !1);
  if (!coords)
    return;
  let channels = getMode(mode).channels;
  for (let ii = 0, c3, ch; ii < channels.length; ii++)
    c3 = coords[ii], ch = channels[ii], c3.type !== Tok.None && (res[ch] = c3.type === Tok.Number ? c3.value : c3.value / 100, ch === "alpha" && (res[ch] = Math.max(0, Math.min(1, res[ch]))));
  return res;
}
function consumeCoords(tokens, includeHue) {
  let coords = [], token;
  for (; tokens._i < tokens.length; ) {
    if (token = tokens[tokens._i++], token.type === Tok.None || token.type === Tok.Number || token.type === Tok.Alpha || token.type === Tok.Percentage || includeHue && token.type === Tok.Hue) {
      coords.push(token);
      continue;
    }
    if (token.type === Tok.ParenClose) {
      if (tokens._i < tokens.length)
        return;
      continue;
    }
    return;
  }
  if (!(coords.length < 3 || coords.length > 4)) {
    if (coords.length === 4) {
      if (coords[3].type !== Tok.Alpha)
        return;
      coords[3] = coords[3].value;
    }
    return coords.length === 3 && coords.push({ type: Tok.None, value: void 0 }), coords.every((c3) => c3.type !== Tok.Alpha) ? coords : void 0;
  }
}
function parseModernSyntax(tokens, includeHue) {
  tokens._i = 0;
  let token = tokens[tokens._i++];
  if (!token || token.type !== Tok.Function)
    return;
  let coords = consumeCoords(tokens, includeHue);
  if (coords)
    return coords.unshift(token.value), coords;
}
var parse = (color) => {
  if (typeof color != "string")
    return;
  let tokens = tokenize(color), parsed = tokens ? parseModernSyntax(tokens, !0) : void 0, result, i2 = 0, len = parsers.length;
  for (; i2 < len; )
    if ((result = parsers[i2++](color, parsed)) !== void 0)
      return result;
  return tokens ? parseColorSyntax(tokens) : void 0;
}, parse_default = parse;

// node_modules/culori/src/rgb/parseRgb.js
function parseRgb(color, parsed) {
  if (!parsed || parsed[0] !== "rgb" && parsed[0] !== "rgba")
    return;
  let res = { mode: "rgb" }, [, r3, g2, b2, alpha] = parsed;
  if (!(r3.type === Tok.Hue || g2.type === Tok.Hue || b2.type === Tok.Hue))
    return r3.type !== Tok.None && (res.r = r3.type === Tok.Number ? r3.value / 255 : r3.value / 100), g2.type !== Tok.None && (res.g = g2.type === Tok.Number ? g2.value / 255 : g2.value / 100), b2.type !== Tok.None && (res.b = b2.type === Tok.Number ? b2.value / 255 : b2.value / 100), alpha.type !== Tok.None && (res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    )), res;
}
var parseRgb_default = parseRgb;

// node_modules/culori/src/rgb/parseTransparent.js
var parseTransparent = (c3) => c3 === "transparent" ? { mode: "rgb", r: 0, g: 0, b: 0, alpha: 0 } : void 0, parseTransparent_default = parseTransparent;

// node_modules/culori/src/interpolate/lerp.js
var lerp = (a2, b2, t3) => a2 + t3 * (b2 - a2);

// node_modules/culori/src/interpolate/piecewise.js
var get_classes = (arr) => {
  let classes = [];
  for (let i2 = 0; i2 < arr.length - 1; i2++) {
    let a2 = arr[i2], b2 = arr[i2 + 1];
    a2 === void 0 && b2 === void 0 ? classes.push(void 0) : a2 !== void 0 && b2 !== void 0 ? classes.push([a2, b2]) : classes.push(a2 !== void 0 ? [a2, a2] : [b2, b2]);
  }
  return classes;
}, interpolatorPiecewise = (interpolator) => (arr) => {
  let classes = get_classes(arr);
  return (t3) => {
    let cls = t3 * classes.length, idx = t3 >= 1 ? classes.length - 1 : Math.max(Math.floor(cls), 0), pair = classes[idx];
    return pair === void 0 ? void 0 : interpolator(pair[0], pair[1], cls - idx);
  };
};

// node_modules/culori/src/interpolate/linear.js
var interpolatorLinear = interpolatorPiecewise(lerp);

// node_modules/culori/src/fixup/alpha.js
var fixupAlpha = (arr) => {
  let some_defined = !1, res = arr.map((v2) => v2 !== void 0 ? (some_defined = !0, v2) : 1);
  return some_defined ? res : arr;
};

// node_modules/culori/src/rgb/definition.js
var definition = {
  mode: "rgb",
  channels: ["r", "g", "b", "alpha"],
  parse: [
    parseRgb_default,
    parseHex_default,
    parseRgbLegacy_default,
    parseNamed_default,
    parseTransparent_default,
    "srgb"
  ],
  serialize: "srgb",
  interpolate: {
    r: interpolatorLinear,
    g: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  gamut: !0,
  white: { r: 1, g: 1, b: 1 },
  black: { r: 0, g: 0, b: 0 }
}, definition_default = definition;

// node_modules/culori/src/a98/convertA98ToXyz65.js
var linearize = (v2 = 0) => Math.pow(Math.abs(v2), 2.19921875) * Math.sign(v2), convertA98ToXyz65 = (a982) => {
  let r3 = linearize(a982.r), g2 = linearize(a982.g), b2 = linearize(a982.b), res = {
    mode: "xyz65",
    x: 0.5766690429101305 * r3 + 0.1855582379065463 * g2 + 0.1882286462349947 * b2,
    y: 0.297344975250536 * r3 + 0.6273635662554661 * g2 + 0.0752914584939979 * b2,
    z: 0.0270313613864123 * r3 + 0.0706888525358272 * g2 + 0.9913375368376386 * b2
  };
  return a982.alpha !== void 0 && (res.alpha = a982.alpha), res;
}, convertA98ToXyz65_default = convertA98ToXyz65;

// node_modules/culori/src/a98/convertXyz65ToA98.js
var gamma = (v2) => Math.pow(Math.abs(v2), 0.4547069271758437) * Math.sign(v2), convertXyz65ToA98 = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = {
    mode: "a98",
    r: gamma(
      x3 * 2.0415879038107465 - y3 * 0.5650069742788597 - 0.3447313507783297 * z
    ),
    g: gamma(
      x3 * -0.9692436362808798 + y3 * 1.8759675015077206 + 0.0415550574071756 * z
    ),
    b: gamma(
      x3 * 0.0134442806320312 - y3 * 0.1183623922310184 + 1.0151749943912058 * z
    )
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToA98_default = convertXyz65ToA98;

// node_modules/culori/src/lrgb/convertRgbToLrgb.js
var fn = (c3 = 0) => {
  let abs4 = Math.abs(c3);
  return abs4 <= 0.04045 ? c3 / 12.92 : (Math.sign(c3) || 1) * Math.pow((abs4 + 0.055) / 1.055, 2.4);
}, convertRgbToLrgb = ({ r: r3, g: g2, b: b2, alpha }) => {
  let res = {
    mode: "lrgb",
    r: fn(r3),
    g: fn(g2),
    b: fn(b2)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToLrgb_default = convertRgbToLrgb;

// node_modules/culori/src/xyz65/convertRgbToXyz65.js
var convertRgbToXyz65 = (rgb3) => {
  let { r: r3, g: g2, b: b2, alpha } = convertRgbToLrgb_default(rgb3), res = {
    mode: "xyz65",
    x: 0.4123907992659593 * r3 + 0.357584339383878 * g2 + 0.1804807884018343 * b2,
    y: 0.2126390058715102 * r3 + 0.715168678767756 * g2 + 0.0721923153607337 * b2,
    z: 0.0193308187155918 * r3 + 0.119194779794626 * g2 + 0.9505321522496607 * b2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToXyz65_default = convertRgbToXyz65;

// node_modules/culori/src/lrgb/convertLrgbToRgb.js
var fn2 = (c3 = 0) => {
  let abs4 = Math.abs(c3);
  return abs4 > 31308e-7 ? (Math.sign(c3) || 1) * (1.055 * Math.pow(abs4, 0.4166666666666667) - 0.055) : c3 * 12.92;
}, convertLrgbToRgb = ({ r: r3, g: g2, b: b2, alpha }, mode = "rgb") => {
  let res = {
    mode,
    r: fn2(r3),
    g: fn2(g2),
    b: fn2(b2)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLrgbToRgb_default = convertLrgbToRgb;

// node_modules/culori/src/xyz65/convertXyz65ToRgb.js
var convertXyz65ToRgb = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = convertLrgbToRgb_default({
    r: x3 * 3.2409699419045226 - y3 * 1.537383177570094 - 0.4986107602930034 * z,
    g: x3 * -0.9692436362808796 + y3 * 1.8759675015077204 + 0.0415550574071756 * z,
    b: x3 * 0.0556300796969936 - y3 * 0.2039769588889765 + 1.0569715142428784 * z
  });
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToRgb_default = convertXyz65ToRgb;

// node_modules/culori/src/a98/definition.js
var definition2 = {
  ...definition_default,
  mode: "a98",
  parse: ["a98-rgb"],
  serialize: "a98-rgb",
  fromMode: {
    rgb: (color) => convertXyz65ToA98_default(convertRgbToXyz65_default(color)),
    xyz65: convertXyz65ToA98_default
  },
  toMode: {
    rgb: (color) => convertXyz65ToRgb_default(convertA98ToXyz65_default(color)),
    xyz65: convertA98ToXyz65_default
  }
}, definition_default2 = definition2;

// node_modules/culori/src/util/normalizeHue.js
var normalizeHue = (hue3) => (hue3 = hue3 % 360) < 0 ? hue3 + 360 : hue3, normalizeHue_default = normalizeHue;

// node_modules/culori/src/fixup/hue.js
var hue2 = (hues, fn5) => hues.map((hue3, idx, arr) => {
  if (hue3 === void 0)
    return hue3;
  let normalized = normalizeHue_default(hue3);
  return idx === 0 || hues[idx - 1] === void 0 ? normalized : fn5(normalized - normalizeHue_default(arr[idx - 1]));
}).reduce((acc, curr) => !acc.length || curr === void 0 || acc[acc.length - 1] === void 0 ? (acc.push(curr), acc) : (acc.push(curr + acc[acc.length - 1]), acc), []), fixupHueShorter = (arr) => hue2(arr, (d2) => Math.abs(d2) <= 180 ? d2 : d2 - 360 * Math.sign(d2));

// node_modules/culori/src/cubehelix/constants.js
var M2 = [-0.14861, 1.78277, -0.29227, -0.90649, 1.97294, 0], degToRad = Math.PI / 180, radToDeg = 180 / Math.PI;

// node_modules/culori/src/cubehelix/convertRgbToCubehelix.js
var DE = M2[3] * M2[4], BE = M2[1] * M2[4], BCAD = M2[1] * M2[2] - M2[0] * M2[3], convertRgbToCubehelix = ({ r: r3, g: g2, b: b2, alpha }) => {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let l2 = (BCAD * b2 + r3 * DE - g2 * BE) / (BCAD + DE - BE), x3 = b2 - l2, y3 = (M2[4] * (g2 - l2) - M2[2] * x3) / M2[3], res = {
    mode: "cubehelix",
    l: l2,
    s: l2 === 0 || l2 === 1 ? void 0 : Math.sqrt(x3 * x3 + y3 * y3) / (M2[4] * l2 * (1 - l2))
  };
  return res.s && (res.h = Math.atan2(y3, x3) * radToDeg - 120), alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToCubehelix_default = convertRgbToCubehelix;

// node_modules/culori/src/cubehelix/convertCubehelixToRgb.js
var convertCubehelixToRgb = ({ h: h2, s: s2, l: l2, alpha }) => {
  let res = { mode: "rgb" };
  h2 = (h2 === void 0 ? 0 : h2 + 120) * degToRad, l2 === void 0 && (l2 = 0);
  let amp = s2 === void 0 ? 0 : s2 * l2 * (1 - l2), cosh = Math.cos(h2), sinh = Math.sin(h2);
  return res.r = l2 + amp * (M2[0] * cosh + M2[1] * sinh), res.g = l2 + amp * (M2[2] * cosh + M2[3] * sinh), res.b = l2 + amp * (M2[4] * cosh + M2[5] * sinh), alpha !== void 0 && (res.alpha = alpha), res;
}, convertCubehelixToRgb_default = convertCubehelixToRgb;

// node_modules/culori/src/difference.js
var differenceHueSaturation = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0 || !std.s || !smp.s)
    return 0;
  let std_h = normalizeHue_default(std.h), smp_h = normalizeHue_default(smp.h), dH = Math.sin((smp_h - std_h + 360) / 2 * Math.PI / 180);
  return 2 * Math.sqrt(std.s * smp.s) * dH;
}, differenceHueNaive = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0)
    return 0;
  let std_h = normalizeHue_default(std.h), smp_h = normalizeHue_default(smp.h);
  return Math.abs(smp_h - std_h) > 180 ? std_h - (smp_h - 360 * Math.sign(smp_h - std_h)) : smp_h - std_h;
}, differenceHueChroma = (std, smp) => {
  if (std.h === void 0 || smp.h === void 0 || !std.c || !smp.c)
    return 0;
  let std_h = normalizeHue_default(std.h), smp_h = normalizeHue_default(smp.h), dH = Math.sin((smp_h - std_h + 360) / 2 * Math.PI / 180);
  return 2 * Math.sqrt(std.c * smp.c) * dH;
};

// node_modules/culori/src/average.js
var averageAngle = (val) => {
  let sum = val.reduce(
    (sum2, val2) => {
      if (val2 !== void 0) {
        let rad = val2 * Math.PI / 180;
        sum2.sin += Math.sin(rad), sum2.cos += Math.cos(rad);
      }
      return sum2;
    },
    { sin: 0, cos: 0 }
  ), angle = Math.atan2(sum.sin, sum.cos) * 180 / Math.PI;
  return angle < 0 ? 360 + angle : angle;
};

// node_modules/culori/src/cubehelix/definition.js
var definition3 = {
  mode: "cubehelix",
  channels: ["h", "s", "l", "alpha"],
  parse: ["--cubehelix"],
  serialize: "--cubehelix",
  ranges: {
    h: [0, 360],
    s: [0, 4.614],
    l: [0, 1]
  },
  fromMode: {
    rgb: convertRgbToCubehelix_default
  },
  toMode: {
    rgb: convertCubehelixToRgb_default
  },
  interpolate: {
    h: {
      use: interpolatorLinear,
      fixup: fixupHueShorter
    },
    s: interpolatorLinear,
    l: interpolatorLinear,
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
}, definition_default3 = definition3;

// node_modules/culori/src/lch/convertLabToLch.js
var convertLabToLch = ({ l: l2, a: a2, b: b2, alpha }, mode = "lch") => {
  a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let c3 = Math.sqrt(a2 * a2 + b2 * b2), res = { mode, l: l2, c: c3 };
  return c3 && (res.h = normalizeHue_default(Math.atan2(b2, a2) * 180 / Math.PI)), alpha !== void 0 && (res.alpha = alpha), res;
}, convertLabToLch_default = convertLabToLch;

// node_modules/culori/src/lch/convertLchToLab.js
var convertLchToLab = ({ l: l2, c: c3, h: h2, alpha }, mode = "lab") => {
  h2 === void 0 && (h2 = 0);
  let res = {
    mode,
    l: l2,
    a: c3 ? c3 * Math.cos(h2 / 180 * Math.PI) : 0,
    b: c3 ? c3 * Math.sin(h2 / 180 * Math.PI) : 0
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLchToLab_default = convertLchToLab;

// node_modules/culori/src/xyz65/constants.js
var k2 = Math.pow(29, 3) / Math.pow(3, 3), e2 = Math.pow(6, 3) / Math.pow(29, 3);

// node_modules/culori/src/constants.js
var D50 = {
  X: 0.9642956764295677,
  Y: 1,
  Z: 0.8251046025104602
}, D65 = {
  X: 0.3127 / 0.329,
  Y: 1,
  Z: (1 - 0.3127 - 0.329) / 0.329
}, k3 = Math.pow(29, 3) / Math.pow(3, 3), e3 = Math.pow(6, 3) / Math.pow(29, 3);

// node_modules/culori/src/lab65/convertLab65ToXyz65.js
var fn3 = (v2) => Math.pow(v2, 3) > e2 ? Math.pow(v2, 3) : (116 * v2 - 16) / k2, convertLab65ToXyz65 = ({ l: l2, a: a2, b: b2, alpha }) => {
  l2 === void 0 && (l2 = 0), a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let fy = (l2 + 16) / 116, fx = a2 / 500 + fy, fz = fy - b2 / 200, res = {
    mode: "xyz65",
    x: fn3(fx) * D65.X,
    y: fn3(fy) * D65.Y,
    z: fn3(fz) * D65.Z
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLab65ToXyz65_default = convertLab65ToXyz65;

// node_modules/culori/src/lab65/convertLab65ToRgb.js
var convertLab65ToRgb = (lab2) => convertXyz65ToRgb_default(convertLab65ToXyz65_default(lab2)), convertLab65ToRgb_default = convertLab65ToRgb;

// node_modules/culori/src/lab65/convertXyz65ToLab65.js
var f2 = (value) => value > e2 ? Math.cbrt(value) : (k2 * value + 16) / 116, convertXyz65ToLab65 = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let f0 = f2(x3 / D65.X), f1 = f2(y3 / D65.Y), f22 = f2(z / D65.Z), res = {
    mode: "lab65",
    l: 116 * f1 - 16,
    a: 500 * (f0 - f1),
    b: 200 * (f1 - f22)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToLab65_default = convertXyz65ToLab65;

// node_modules/culori/src/lab65/convertRgbToLab65.js
var convertRgbToLab65 = (rgb3) => {
  let res = convertXyz65ToLab65_default(convertRgbToXyz65_default(rgb3));
  return rgb3.r === rgb3.b && rgb3.b === rgb3.g && (res.a = res.b = 0), res;
}, convertRgbToLab65_default = convertRgbToLab65;

// node_modules/culori/src/dlch/constants.js
var \u03B8 = 0.14444444444444443 * Math.PI, cos\u03B8 = Math.cos(\u03B8), sin\u03B8 = Math.sin(\u03B8), factor = 100 / Math.log(139 / 100);

// node_modules/culori/src/dlch/convertDlchToLab65.js
var convertDlchToLab65 = ({ l: l2, c: c3, h: h2, alpha }) => {
  l2 === void 0 && (l2 = 0), c3 === void 0 && (c3 = 0), h2 === void 0 && (h2 = 0);
  let res = {
    mode: "lab65",
    l: (Math.exp(l2 * 1 / factor) - 1) / 39e-4
  }, G = (Math.exp(0.0435 * c3 * 1 * 1) - 1) / 0.075, e5 = G * Math.cos(h2 / 180 * Math.PI - \u03B8), f4 = G * Math.sin(h2 / 180 * Math.PI - \u03B8);
  return res.a = e5 * cos\u03B8 - f4 / 0.83 * sin\u03B8, res.b = e5 * sin\u03B8 + f4 / 0.83 * cos\u03B8, alpha !== void 0 && (res.alpha = alpha), res;
}, convertDlchToLab65_default = convertDlchToLab65;

// node_modules/culori/src/dlch/convertLab65ToDlch.js
var convertLab65ToDlch = ({ l: l2, a: a2, b: b2, alpha }) => {
  l2 === void 0 && (l2 = 0), a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let e5 = a2 * cos\u03B8 + b2 * sin\u03B8, f4 = 0.83 * (b2 * cos\u03B8 - a2 * sin\u03B8), G = Math.sqrt(e5 * e5 + f4 * f4), res = {
    mode: "dlch",
    l: factor / 1 * Math.log(1 + 39e-4 * l2),
    c: Math.log(1 + 0.075 * G) / (0.0435 * 1 * 1)
  };
  return res.c && (res.h = normalizeHue_default((Math.atan2(f4, e5) + \u03B8) / Math.PI * 180)), alpha !== void 0 && (res.alpha = alpha), res;
}, convertLab65ToDlch_default = convertLab65ToDlch;

// node_modules/culori/src/dlab/definition.js
var convertDlabToLab65 = (c3) => convertDlchToLab65_default(convertLabToLch_default(c3, "dlch")), convertLab65ToDlab = (c3) => convertLchToLab_default(convertLab65ToDlch_default(c3), "dlab"), definition4 = {
  mode: "dlab",
  parse: ["--din99o-lab"],
  serialize: "--din99o-lab",
  toMode: {
    lab65: convertDlabToLab65,
    rgb: (c3) => convertLab65ToRgb_default(convertDlabToLab65(c3))
  },
  fromMode: {
    lab65: convertLab65ToDlab,
    rgb: (c3) => convertLab65ToDlab(convertRgbToLab65_default(c3))
  },
  channels: ["l", "a", "b", "alpha"],
  ranges: {
    l: [0, 100],
    a: [-40.09, 45.501],
    b: [-40.469, 44.344]
  },
  interpolate: {
    l: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  }
}, definition_default4 = definition4;

// node_modules/culori/src/dlch/definition.js
var definition5 = {
  mode: "dlch",
  parse: ["--din99o-lch"],
  serialize: "--din99o-lch",
  toMode: {
    lab65: convertDlchToLab65_default,
    dlab: (c3) => convertLchToLab_default(c3, "dlab"),
    rgb: (c3) => convertLab65ToRgb_default(convertDlchToLab65_default(c3))
  },
  fromMode: {
    lab65: convertLab65ToDlch_default,
    dlab: (c3) => convertLabToLch_default(c3, "dlch"),
    rgb: (c3) => convertLab65ToDlch_default(convertRgbToLab65_default(c3))
  },
  channels: ["l", "c", "h", "alpha"],
  ranges: {
    l: [0, 100],
    c: [0, 51.484],
    h: [0, 360]
  },
  interpolate: {
    l: interpolatorLinear,
    c: interpolatorLinear,
    h: {
      use: interpolatorLinear,
      fixup: fixupHueShorter
    },
    alpha: {
      use: interpolatorLinear,
      fixup: fixupAlpha
    }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
}, definition_default5 = definition5;

// node_modules/culori/src/hsi/convertHsiToRgb.js
function convertHsiToRgb({ h: h2, s: s2, i: i2, alpha }) {
  h2 = normalizeHue_default(h2 !== void 0 ? h2 : 0), s2 === void 0 && (s2 = 0), i2 === void 0 && (i2 = 0);
  let f4 = Math.abs(h2 / 60 % 2 - 1), res;
  switch (Math.floor(h2 / 60)) {
    case 0:
      res = {
        r: i2 * (1 + s2 * (3 / (2 - f4) - 1)),
        g: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1)),
        b: i2 * (1 - s2)
      };
      break;
    case 1:
      res = {
        r: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1)),
        g: i2 * (1 + s2 * (3 / (2 - f4) - 1)),
        b: i2 * (1 - s2)
      };
      break;
    case 2:
      res = {
        r: i2 * (1 - s2),
        g: i2 * (1 + s2 * (3 / (2 - f4) - 1)),
        b: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1))
      };
      break;
    case 3:
      res = {
        r: i2 * (1 - s2),
        g: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1)),
        b: i2 * (1 + s2 * (3 / (2 - f4) - 1))
      };
      break;
    case 4:
      res = {
        r: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1)),
        g: i2 * (1 - s2),
        b: i2 * (1 + s2 * (3 / (2 - f4) - 1))
      };
      break;
    case 5:
      res = {
        r: i2 * (1 + s2 * (3 / (2 - f4) - 1)),
        g: i2 * (1 - s2),
        b: i2 * (1 + s2 * (3 * (1 - f4) / (2 - f4) - 1))
      };
      break;
    default:
      res = { r: i2 * (1 - s2), g: i2 * (1 - s2), b: i2 * (1 - s2) };
  }
  return res.mode = "rgb", alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/hsi/convertRgbToHsi.js
function convertRgbToHsi({ r: r3, g: g2, b: b2, alpha }) {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let M3 = Math.max(r3, g2, b2), m2 = Math.min(r3, g2, b2), res = {
    mode: "hsi",
    s: r3 + g2 + b2 === 0 ? 0 : 1 - 3 * m2 / (r3 + g2 + b2),
    i: (r3 + g2 + b2) / 3
  };
  return M3 - m2 !== 0 && (res.h = (M3 === r3 ? (g2 - b2) / (M3 - m2) + (g2 < b2) * 6 : M3 === g2 ? (b2 - r3) / (M3 - m2) + 2 : (r3 - g2) / (M3 - m2) + 4) * 60), alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/hsi/definition.js
var definition6 = {
  mode: "hsi",
  toMode: {
    rgb: convertHsiToRgb
  },
  parse: ["--hsi"],
  serialize: "--hsi",
  fromMode: {
    rgb: convertRgbToHsi
  },
  channels: ["h", "s", "i", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    i: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
}, definition_default6 = definition6;

// node_modules/culori/src/hsl/convertHslToRgb.js
function convertHslToRgb({ h: h2, s: s2, l: l2, alpha }) {
  h2 = normalizeHue_default(h2 !== void 0 ? h2 : 0), s2 === void 0 && (s2 = 0), l2 === void 0 && (l2 = 0);
  let m1 = l2 + s2 * (l2 < 0.5 ? l2 : 1 - l2), m2 = m1 - (m1 - l2) * 2 * Math.abs(h2 / 60 % 2 - 1), res;
  switch (Math.floor(h2 / 60)) {
    case 0:
      res = { r: m1, g: m2, b: 2 * l2 - m1 };
      break;
    case 1:
      res = { r: m2, g: m1, b: 2 * l2 - m1 };
      break;
    case 2:
      res = { r: 2 * l2 - m1, g: m1, b: m2 };
      break;
    case 3:
      res = { r: 2 * l2 - m1, g: m2, b: m1 };
      break;
    case 4:
      res = { r: m2, g: 2 * l2 - m1, b: m1 };
      break;
    case 5:
      res = { r: m1, g: 2 * l2 - m1, b: m2 };
      break;
    default:
      res = { r: 2 * l2 - m1, g: 2 * l2 - m1, b: 2 * l2 - m1 };
  }
  return res.mode = "rgb", alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/hsl/convertRgbToHsl.js
function convertRgbToHsl({ r: r3, g: g2, b: b2, alpha }) {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let M3 = Math.max(r3, g2, b2), m2 = Math.min(r3, g2, b2), res = {
    mode: "hsl",
    s: M3 === m2 ? 0 : (M3 - m2) / (1 - Math.abs(M3 + m2 - 1)),
    l: 0.5 * (M3 + m2)
  };
  return M3 - m2 !== 0 && (res.h = (M3 === r3 ? (g2 - b2) / (M3 - m2) + (g2 < b2) * 6 : M3 === g2 ? (b2 - r3) / (M3 - m2) + 2 : (r3 - g2) / (M3 - m2) + 4) * 60), alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/util/hue.js
var hueToDeg = (val, unit) => {
  switch (unit) {
    case "deg":
      return +val;
    case "rad":
      return val / Math.PI * 180;
    case "grad":
      return val / 10 * 9;
    case "turn":
      return val * 360;
  }
}, hue_default = hueToDeg;

// node_modules/culori/src/hsl/parseHslLegacy.js
var hsl_old = new RegExp(
  `^hsla?\\(\\s*${hue}${c2}${per}${c2}${per}\\s*(?:,\\s*${num_per}\\s*)?\\)$`
), parseHslLegacy = (color) => {
  let match = color.match(hsl_old);
  if (!match) return;
  let res = { mode: "hsl" };
  return match[3] !== void 0 ? res.h = +match[3] : match[1] !== void 0 && match[2] !== void 0 && (res.h = hue_default(match[1], match[2])), match[4] !== void 0 && (res.s = Math.min(Math.max(0, match[4] / 100), 1)), match[5] !== void 0 && (res.l = Math.min(Math.max(0, match[5] / 100), 1)), match[6] !== void 0 ? res.alpha = Math.max(0, Math.min(1, match[6] / 100)) : match[7] !== void 0 && (res.alpha = Math.max(0, Math.min(1, +match[7]))), res;
}, parseHslLegacy_default = parseHslLegacy;

// node_modules/culori/src/hsl/parseHsl.js
function parseHsl(color, parsed) {
  if (!parsed || parsed[0] !== "hsl" && parsed[0] !== "hsla")
    return;
  let res = { mode: "hsl" }, [, h2, s2, l2, alpha] = parsed;
  if (h2.type !== Tok.None) {
    if (h2.type === Tok.Percentage)
      return;
    res.h = h2.value;
  }
  if (s2.type !== Tok.None) {
    if (s2.type === Tok.Hue)
      return;
    res.s = s2.value / 100;
  }
  if (l2.type !== Tok.None) {
    if (l2.type === Tok.Hue)
      return;
    res.l = l2.value / 100;
  }
  return alpha.type !== Tok.None && (res.alpha = Math.min(
    1,
    Math.max(
      0,
      alpha.type === Tok.Number ? alpha.value : alpha.value / 100
    )
  )), res;
}
var parseHsl_default = parseHsl;

// node_modules/culori/src/hsl/definition.js
var definition7 = {
  mode: "hsl",
  toMode: {
    rgb: convertHslToRgb
  },
  fromMode: {
    rgb: convertRgbToHsl
  },
  channels: ["h", "s", "l", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  parse: [parseHsl_default, parseHslLegacy_default],
  serialize: (c3) => `hsl(${c3.h !== void 0 ? c3.h : "none"} ${c3.s !== void 0 ? c3.s * 100 + "%" : "none"} ${c3.l !== void 0 ? c3.l * 100 + "%" : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
}, definition_default7 = definition7;

// node_modules/culori/src/hsv/convertHsvToRgb.js
function convertHsvToRgb({ h: h2, s: s2, v: v2, alpha }) {
  h2 = normalizeHue_default(h2 !== void 0 ? h2 : 0), s2 === void 0 && (s2 = 0), v2 === void 0 && (v2 = 0);
  let f4 = Math.abs(h2 / 60 % 2 - 1), res;
  switch (Math.floor(h2 / 60)) {
    case 0:
      res = { r: v2, g: v2 * (1 - s2 * f4), b: v2 * (1 - s2) };
      break;
    case 1:
      res = { r: v2 * (1 - s2 * f4), g: v2, b: v2 * (1 - s2) };
      break;
    case 2:
      res = { r: v2 * (1 - s2), g: v2, b: v2 * (1 - s2 * f4) };
      break;
    case 3:
      res = { r: v2 * (1 - s2), g: v2 * (1 - s2 * f4), b: v2 };
      break;
    case 4:
      res = { r: v2 * (1 - s2 * f4), g: v2 * (1 - s2), b: v2 };
      break;
    case 5:
      res = { r: v2, g: v2 * (1 - s2), b: v2 * (1 - s2 * f4) };
      break;
    default:
      res = { r: v2 * (1 - s2), g: v2 * (1 - s2), b: v2 * (1 - s2) };
  }
  return res.mode = "rgb", alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/hsv/convertRgbToHsv.js
function convertRgbToHsv({ r: r3, g: g2, b: b2, alpha }) {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let M3 = Math.max(r3, g2, b2), m2 = Math.min(r3, g2, b2), res = {
    mode: "hsv",
    s: M3 === 0 ? 0 : 1 - m2 / M3,
    v: M3
  };
  return M3 - m2 !== 0 && (res.h = (M3 === r3 ? (g2 - b2) / (M3 - m2) + (g2 < b2) * 6 : M3 === g2 ? (b2 - r3) / (M3 - m2) + 2 : (r3 - g2) / (M3 - m2) + 4) * 60), alpha !== void 0 && (res.alpha = alpha), res;
}

// node_modules/culori/src/hsv/definition.js
var definition8 = {
  mode: "hsv",
  toMode: {
    rgb: convertHsvToRgb
  },
  parse: ["--hsv"],
  serialize: "--hsv",
  fromMode: {
    rgb: convertRgbToHsv
  },
  channels: ["h", "s", "v", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    s: interpolatorLinear,
    v: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueSaturation
  },
  average: {
    h: averageAngle
  }
}, definition_default8 = definition8;

// node_modules/culori/src/hwb/convertHwbToRgb.js
function convertHwbToRgb({ h: h2, w: w2, b: b2, alpha }) {
  if (w2 === void 0 && (w2 = 0), b2 === void 0 && (b2 = 0), w2 + b2 > 1) {
    let s2 = w2 + b2;
    w2 /= s2, b2 /= s2;
  }
  return convertHsvToRgb({
    h: h2,
    s: b2 === 1 ? 1 : 1 - w2 / (1 - b2),
    v: 1 - b2,
    alpha
  });
}

// node_modules/culori/src/hwb/convertRgbToHwb.js
function convertRgbToHwb(rgba) {
  let hsv2 = convertRgbToHsv(rgba);
  if (hsv2 === void 0) return;
  let s2 = hsv2.s !== void 0 ? hsv2.s : 0, v2 = hsv2.v !== void 0 ? hsv2.v : 0, res = {
    mode: "hwb",
    w: (1 - s2) * v2,
    b: 1 - v2
  };
  return hsv2.h !== void 0 && (res.h = hsv2.h), hsv2.alpha !== void 0 && (res.alpha = hsv2.alpha), res;
}

// node_modules/culori/src/hwb/parseHwb.js
function ParseHwb(color, parsed) {
  if (!parsed || parsed[0] !== "hwb")
    return;
  let res = { mode: "hwb" }, [, h2, w2, b2, alpha] = parsed;
  if (h2.type !== Tok.None) {
    if (h2.type === Tok.Percentage)
      return;
    res.h = h2.value;
  }
  if (w2.type !== Tok.None) {
    if (w2.type === Tok.Hue)
      return;
    res.w = w2.value / 100;
  }
  if (b2.type !== Tok.None) {
    if (b2.type === Tok.Hue)
      return;
    res.b = b2.value / 100;
  }
  return alpha.type !== Tok.None && (res.alpha = Math.min(
    1,
    Math.max(
      0,
      alpha.type === Tok.Number ? alpha.value : alpha.value / 100
    )
  )), res;
}
var parseHwb_default = ParseHwb;

// node_modules/culori/src/hwb/definition.js
var definition9 = {
  mode: "hwb",
  toMode: {
    rgb: convertHwbToRgb
  },
  fromMode: {
    rgb: convertRgbToHwb
  },
  channels: ["h", "w", "b", "alpha"],
  ranges: {
    h: [0, 360]
  },
  gamut: "rgb",
  parse: [parseHwb_default],
  serialize: (c3) => `hwb(${c3.h !== void 0 ? c3.h : "none"} ${c3.w !== void 0 ? c3.w * 100 + "%" : "none"} ${c3.b !== void 0 ? c3.b * 100 + "%" : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    w: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueNaive
  },
  average: {
    h: averageAngle
  }
}, definition_default9 = definition9;

// node_modules/culori/src/hdr/transfer.js
var M1 = 0.1593017578125, M22 = 78.84375, C1 = 0.8359375, C2 = 18.8515625, C3 = 18.6875;
function transferPqDecode(v2) {
  if (v2 < 0) return 0;
  let c3 = Math.pow(v2, 1 / M22);
  return 1e4 * Math.pow(Math.max(0, c3 - C1) / (C2 - C3 * c3), 1 / M1);
}
function transferPqEncode(v2) {
  if (v2 < 0) return 0;
  let c3 = Math.pow(v2 / 1e4, M1);
  return Math.pow((C1 + C2 * c3) / (1 + C3 * c3), M22);
}

// node_modules/culori/src/itp/convertItpToXyz65.js
var toRel = (c3) => Math.max(c3 / 203, 0), convertItpToXyz65 = ({ i: i2, t: t3, p: p4, alpha }) => {
  i2 === void 0 && (i2 = 0), t3 === void 0 && (t3 = 0), p4 === void 0 && (p4 = 0);
  let l2 = transferPqDecode(
    i2 + 0.008609037037932761 * t3 + 0.11102962500302593 * p4
  ), m2 = transferPqDecode(
    i2 - 0.00860903703793275 * t3 - 0.11102962500302599 * p4
  ), s2 = transferPqDecode(
    i2 + 0.5600313357106791 * t3 - 0.32062717498731885 * p4
  ), res = {
    mode: "xyz65",
    x: toRel(
      2.070152218389422 * l2 - 1.3263473389671556 * m2 + 0.2066510476294051 * s2
    ),
    y: toRel(
      0.3647385209748074 * l2 + 0.680566024947227 * m2 - 0.0453045459220346 * s2
    ),
    z: toRel(
      -0.049747207535812 * l2 - 0.0492609666966138 * m2 + 1.1880659249923042 * s2
    )
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertItpToXyz65_default = convertItpToXyz65;

// node_modules/culori/src/itp/convertXyz65ToItp.js
var toAbs = (c3 = 0) => Math.max(c3 * 203, 0), convertXyz65ToItp = ({ x: x3, y: y3, z, alpha }) => {
  let absX = toAbs(x3), absY = toAbs(y3), absZ = toAbs(z), l2 = transferPqEncode(
    0.3592832590121217 * absX + 0.6976051147779502 * absY - 0.0358915932320289 * absZ
  ), m2 = transferPqEncode(
    -0.1920808463704995 * absX + 1.1004767970374323 * absY + 0.0753748658519118 * absZ
  ), s2 = transferPqEncode(
    0.0070797844607477 * absX + 0.0748396662186366 * absY + 0.8433265453898765 * absZ
  ), i2 = 0.5 * l2 + 0.5 * m2, t3 = 1.61376953125 * l2 - 3.323486328125 * m2 + 1.709716796875 * s2, p4 = 4.378173828125 * l2 - 4.24560546875 * m2 - 0.132568359375 * s2, res = { mode: "itp", i: i2, t: t3, p: p4 };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToItp_default = convertXyz65ToItp;

// node_modules/culori/src/itp/definition.js
var definition10 = {
  mode: "itp",
  channels: ["i", "t", "p", "alpha"],
  parse: ["--ictcp"],
  serialize: "--ictcp",
  toMode: {
    xyz65: convertItpToXyz65_default,
    rgb: (color) => convertXyz65ToRgb_default(convertItpToXyz65_default(color))
  },
  fromMode: {
    xyz65: convertXyz65ToItp_default,
    rgb: (color) => convertXyz65ToItp_default(convertRgbToXyz65_default(color))
  },
  ranges: {
    i: [0, 0.581],
    t: [-0.369, 0.272],
    p: [-0.164, 0.331]
  },
  interpolate: {
    i: interpolatorLinear,
    t: interpolatorLinear,
    p: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default10 = definition10;

// node_modules/culori/src/jab/convertXyz65ToJab.js
var p2 = 134.03437499999998, d0 = 16295499532821565e-27, jabPqEncode = (v2) => {
  if (v2 < 0) return 0;
  let vn3 = Math.pow(v2 / 1e4, M1);
  return Math.pow((C1 + C2 * vn3) / (1 + C3 * vn3), p2);
}, abs3 = (v2 = 0) => Math.max(v2 * 203, 0), convertXyz65ToJab = ({ x: x3, y: y3, z, alpha }) => {
  x3 = abs3(x3), y3 = abs3(y3), z = abs3(z);
  let xp = 1.15 * x3 - 0.15 * z, yp = 0.66 * y3 + 0.34 * x3, l2 = jabPqEncode(0.41478972 * xp + 0.579999 * yp + 0.014648 * z), m2 = jabPqEncode(-0.20151 * xp + 1.120649 * yp + 0.0531008 * z), s2 = jabPqEncode(-0.0166008 * xp + 0.2648 * yp + 0.6684799 * z), i2 = (l2 + m2) / 2, res = {
    mode: "jab",
    j: 0.44 * i2 / (1 - 0.56 * i2) - d0,
    a: 3.524 * l2 - 4.066708 * m2 + 0.542708 * s2,
    b: 0.199076 * l2 + 1.096799 * m2 - 1.295875 * s2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToJab_default = convertXyz65ToJab;

// node_modules/culori/src/jab/convertJabToXyz65.js
var p3 = 134.03437499999998, d02 = 16295499532821565e-27, jabPqDecode = (v2) => {
  if (v2 < 0) return 0;
  let vp = Math.pow(v2, 1 / p3);
  return 1e4 * Math.pow((C1 - vp) / (C3 * vp - C2), 1 / M1);
}, rel = (v2) => v2 / 203, convertJabToXyz65 = ({ j: j2, a: a2, b: b2, alpha }) => {
  j2 === void 0 && (j2 = 0), a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let i2 = (j2 + d02) / (0.44 + 0.56 * (j2 + d02)), l2 = jabPqDecode(i2 + 0.13860504 * a2 + 0.058047316 * b2), m2 = jabPqDecode(i2 - 0.13860504 * a2 - 0.058047316 * b2), s2 = jabPqDecode(i2 - 0.096019242 * a2 - 0.8118919 * b2), res = {
    mode: "xyz65",
    x: rel(
      1.661373024652174 * l2 - 0.914523081304348 * m2 + 0.23136208173913045 * s2
    ),
    y: rel(
      -0.3250758611844533 * l2 + 1.571847026732543 * m2 - 0.21825383453227928 * s2
    ),
    z: rel(-0.090982811 * l2 - 0.31272829 * m2 + 1.5227666 * s2)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertJabToXyz65_default = convertJabToXyz65;

// node_modules/culori/src/jab/convertRgbToJab.js
var convertRgbToJab = (rgb3) => {
  let res = convertXyz65ToJab_default(convertRgbToXyz65_default(rgb3));
  return rgb3.r === rgb3.b && rgb3.b === rgb3.g && (res.a = res.b = 0), res;
}, convertRgbToJab_default = convertRgbToJab;

// node_modules/culori/src/jab/convertJabToRgb.js
var convertJabToRgb = (color) => convertXyz65ToRgb_default(convertJabToXyz65_default(color)), convertJabToRgb_default = convertJabToRgb;

// node_modules/culori/src/jab/definition.js
var definition11 = {
  mode: "jab",
  channels: ["j", "a", "b", "alpha"],
  parse: ["--jzazbz"],
  serialize: "--jzazbz",
  fromMode: {
    rgb: convertRgbToJab_default,
    xyz65: convertXyz65ToJab_default
  },
  toMode: {
    rgb: convertJabToRgb_default,
    xyz65: convertJabToXyz65_default
  },
  ranges: {
    j: [0, 0.222],
    a: [-0.109, 0.129],
    b: [-0.185, 0.134]
  },
  interpolate: {
    j: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default11 = definition11;

// node_modules/culori/src/jch/convertJabToJch.js
var convertJabToJch = ({ j: j2, a: a2, b: b2, alpha }) => {
  a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let c3 = Math.sqrt(a2 * a2 + b2 * b2), res = {
    mode: "jch",
    j: j2,
    c: c3
  };
  return c3 && (res.h = normalizeHue_default(Math.atan2(b2, a2) * 180 / Math.PI)), alpha !== void 0 && (res.alpha = alpha), res;
}, convertJabToJch_default = convertJabToJch;

// node_modules/culori/src/jch/convertJchToJab.js
var convertJchToJab = ({ j: j2, c: c3, h: h2, alpha }) => {
  h2 === void 0 && (h2 = 0);
  let res = {
    mode: "jab",
    j: j2,
    a: c3 ? c3 * Math.cos(h2 / 180 * Math.PI) : 0,
    b: c3 ? c3 * Math.sin(h2 / 180 * Math.PI) : 0
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertJchToJab_default = convertJchToJab;

// node_modules/culori/src/jch/definition.js
var definition12 = {
  mode: "jch",
  parse: ["--jzczhz"],
  serialize: "--jzczhz",
  toMode: {
    jab: convertJchToJab_default,
    rgb: (c3) => convertJabToRgb_default(convertJchToJab_default(c3))
  },
  fromMode: {
    rgb: (c3) => convertJabToJch_default(convertRgbToJab_default(c3)),
    jab: convertJabToJch_default
  },
  channels: ["j", "c", "h", "alpha"],
  ranges: {
    j: [0, 0.221],
    c: [0, 0.19],
    h: [0, 360]
  },
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    j: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
}, definition_default12 = definition12;

// node_modules/culori/src/xyz50/constants.js
var k4 = Math.pow(29, 3) / Math.pow(3, 3), e4 = Math.pow(6, 3) / Math.pow(29, 3);

// node_modules/culori/src/lab/convertLabToXyz50.js
var fn4 = (v2) => Math.pow(v2, 3) > e4 ? Math.pow(v2, 3) : (116 * v2 - 16) / k4, convertLabToXyz50 = ({ l: l2, a: a2, b: b2, alpha }) => {
  l2 === void 0 && (l2 = 0), a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let fy = (l2 + 16) / 116, fx = a2 / 500 + fy, fz = fy - b2 / 200, res = {
    mode: "xyz50",
    x: fn4(fx) * D50.X,
    y: fn4(fy) * D50.Y,
    z: fn4(fz) * D50.Z
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLabToXyz50_default = convertLabToXyz50;

// node_modules/culori/src/xyz50/convertXyz50ToRgb.js
var convertXyz50ToRgb = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = convertLrgbToRgb_default({
    r: x3 * 3.1341359569958707 - y3 * 1.6173863321612538 - 0.4906619460083532 * z,
    g: x3 * -0.978795502912089 + y3 * 1.916254567259524 + 0.03344273116131949 * z,
    b: x3 * 0.07195537988411677 - y3 * 0.2289768264158322 + 1.405386058324125 * z
  });
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz50ToRgb_default = convertXyz50ToRgb;

// node_modules/culori/src/lab/convertLabToRgb.js
var convertLabToRgb = (lab2) => convertXyz50ToRgb_default(convertLabToXyz50_default(lab2)), convertLabToRgb_default = convertLabToRgb;

// node_modules/culori/src/xyz50/convertRgbToXyz50.js
var convertRgbToXyz50 = (rgb3) => {
  let { r: r3, g: g2, b: b2, alpha } = convertRgbToLrgb_default(rgb3), res = {
    mode: "xyz50",
    x: 0.436065742824811 * r3 + 0.3851514688337912 * g2 + 0.14307845442264197 * b2,
    y: 0.22249319175623702 * r3 + 0.7168870538238823 * g2 + 0.06061979053616537 * b2,
    z: 0.013923904500943465 * r3 + 0.09708128566574634 * g2 + 0.7140993584005155 * b2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToXyz50_default = convertRgbToXyz50;

// node_modules/culori/src/lab/convertXyz50ToLab.js
var f3 = (value) => value > e4 ? Math.cbrt(value) : (k4 * value + 16) / 116, convertXyz50ToLab = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let f0 = f3(x3 / D50.X), f1 = f3(y3 / D50.Y), f22 = f3(z / D50.Z), res = {
    mode: "lab",
    l: 116 * f1 - 16,
    a: 500 * (f0 - f1),
    b: 200 * (f1 - f22)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz50ToLab_default = convertXyz50ToLab;

// node_modules/culori/src/lab/convertRgbToLab.js
var convertRgbToLab = (rgb3) => {
  let res = convertXyz50ToLab_default(convertRgbToXyz50_default(rgb3));
  return rgb3.r === rgb3.b && rgb3.b === rgb3.g && (res.a = res.b = 0), res;
}, convertRgbToLab_default = convertRgbToLab;

// node_modules/culori/src/lab/parseLab.js
function parseLab(color, parsed) {
  if (!parsed || parsed[0] !== "lab")
    return;
  let res = { mode: "lab" }, [, l2, a2, b2, alpha] = parsed;
  if (!(l2.type === Tok.Hue || a2.type === Tok.Hue || b2.type === Tok.Hue))
    return l2.type !== Tok.None && (res.l = Math.min(Math.max(0, l2.value), 100)), a2.type !== Tok.None && (res.a = a2.type === Tok.Number ? a2.value : a2.value * 125 / 100), b2.type !== Tok.None && (res.b = b2.type === Tok.Number ? b2.value : b2.value * 125 / 100), alpha.type !== Tok.None && (res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    )), res;
}
var parseLab_default = parseLab;

// node_modules/culori/src/lab/definition.js
var definition13 = {
  mode: "lab",
  toMode: {
    xyz50: convertLabToXyz50_default,
    rgb: convertLabToRgb_default
  },
  fromMode: {
    xyz50: convertXyz50ToLab_default,
    rgb: convertRgbToLab_default
  },
  channels: ["l", "a", "b", "alpha"],
  ranges: {
    l: [0, 100],
    a: [-125, 125],
    b: [-125, 125]
  },
  parse: [parseLab_default],
  serialize: (c3) => `lab(${c3.l !== void 0 ? c3.l : "none"} ${c3.a !== void 0 ? c3.a : "none"} ${c3.b !== void 0 ? c3.b : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`,
  interpolate: {
    l: interpolatorLinear,
    a: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default13 = definition13;

// node_modules/culori/src/lab65/definition.js
var definition14 = {
  ...definition_default13,
  mode: "lab65",
  parse: ["--lab-d65"],
  serialize: "--lab-d65",
  toMode: {
    xyz65: convertLab65ToXyz65_default,
    rgb: convertLab65ToRgb_default
  },
  fromMode: {
    xyz65: convertXyz65ToLab65_default,
    rgb: convertRgbToLab65_default
  },
  ranges: {
    l: [0, 100],
    a: [-125, 125],
    b: [-125, 125]
  }
}, definition_default14 = definition14;

// node_modules/culori/src/lch/parseLch.js
function parseLch(color, parsed) {
  if (!parsed || parsed[0] !== "lch")
    return;
  let res = { mode: "lch" }, [, l2, c3, h2, alpha] = parsed;
  if (l2.type !== Tok.None) {
    if (l2.type === Tok.Hue)
      return;
    res.l = Math.min(Math.max(0, l2.value), 100);
  }
  if (c3.type !== Tok.None && (res.c = Math.max(
    0,
    c3.type === Tok.Number ? c3.value : c3.value * 150 / 100
  )), h2.type !== Tok.None) {
    if (h2.type === Tok.Percentage)
      return;
    res.h = h2.value;
  }
  return alpha.type !== Tok.None && (res.alpha = Math.min(
    1,
    Math.max(
      0,
      alpha.type === Tok.Number ? alpha.value : alpha.value / 100
    )
  )), res;
}
var parseLch_default = parseLch;

// node_modules/culori/src/lch/definition.js
var definition15 = {
  mode: "lch",
  toMode: {
    lab: convertLchToLab_default,
    rgb: (c3) => convertLabToRgb_default(convertLchToLab_default(c3))
  },
  fromMode: {
    rgb: (c3) => convertLabToLch_default(convertRgbToLab_default(c3)),
    lab: convertLabToLch_default
  },
  channels: ["l", "c", "h", "alpha"],
  ranges: {
    l: [0, 100],
    c: [0, 150],
    h: [0, 360]
  },
  parse: [parseLch_default],
  serialize: (c3) => `lch(${c3.l !== void 0 ? c3.l : "none"} ${c3.c !== void 0 ? c3.c : "none"} ${c3.h !== void 0 ? c3.h : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`,
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
}, definition_default15 = definition15;

// node_modules/culori/src/lch65/definition.js
var definition16 = {
  ...definition_default15,
  mode: "lch65",
  parse: ["--lch-d65"],
  serialize: "--lch-d65",
  toMode: {
    lab65: (c3) => convertLchToLab_default(c3, "lab65"),
    rgb: (c3) => convertLab65ToRgb_default(convertLchToLab_default(c3, "lab65"))
  },
  fromMode: {
    rgb: (c3) => convertLabToLch_default(convertRgbToLab65_default(c3), "lch65"),
    lab65: (c3) => convertLabToLch_default(c3, "lch65")
  },
  ranges: {
    l: [0, 100],
    c: [0, 150],
    h: [0, 360]
  }
}, definition_default16 = definition16;

// node_modules/culori/src/lchuv/convertLuvToLchuv.js
var convertLuvToLchuv = ({ l: l2, u: u2, v: v2, alpha }) => {
  u2 === void 0 && (u2 = 0), v2 === void 0 && (v2 = 0);
  let c3 = Math.sqrt(u2 * u2 + v2 * v2), res = {
    mode: "lchuv",
    l: l2,
    c: c3
  };
  return c3 && (res.h = normalizeHue_default(Math.atan2(v2, u2) * 180 / Math.PI)), alpha !== void 0 && (res.alpha = alpha), res;
}, convertLuvToLchuv_default = convertLuvToLchuv;

// node_modules/culori/src/lchuv/convertLchuvToLuv.js
var convertLchuvToLuv = ({ l: l2, c: c3, h: h2, alpha }) => {
  h2 === void 0 && (h2 = 0);
  let res = {
    mode: "luv",
    l: l2,
    u: c3 ? c3 * Math.cos(h2 / 180 * Math.PI) : 0,
    v: c3 ? c3 * Math.sin(h2 / 180 * Math.PI) : 0
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLchuvToLuv_default = convertLchuvToLuv;

// node_modules/culori/src/luv/convertXyz50ToLuv.js
var u_fn = (x3, y3, z) => 4 * x3 / (x3 + 15 * y3 + 3 * z), v_fn = (x3, y3, z) => 9 * y3 / (x3 + 15 * y3 + 3 * z), un = u_fn(D50.X, D50.Y, D50.Z), vn = v_fn(D50.X, D50.Y, D50.Z), l_fn = (value) => value <= e4 ? k4 * value : 116 * Math.cbrt(value) - 16, convertXyz50ToLuv = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let l2 = l_fn(y3 / D50.Y), u2 = u_fn(x3, y3, z), v2 = v_fn(x3, y3, z);
  !isFinite(u2) || !isFinite(v2) ? l2 = u2 = v2 = 0 : (u2 = 13 * l2 * (u2 - un), v2 = 13 * l2 * (v2 - vn));
  let res = {
    mode: "luv",
    l: l2,
    u: u2,
    v: v2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz50ToLuv_default = convertXyz50ToLuv;

// node_modules/culori/src/luv/convertLuvToXyz50.js
var u_fn2 = (x3, y3, z) => 4 * x3 / (x3 + 15 * y3 + 3 * z), v_fn2 = (x3, y3, z) => 9 * y3 / (x3 + 15 * y3 + 3 * z), un2 = u_fn2(D50.X, D50.Y, D50.Z), vn2 = v_fn2(D50.X, D50.Y, D50.Z), convertLuvToXyz50 = ({ l: l2, u: u2, v: v2, alpha }) => {
  if (l2 === void 0 && (l2 = 0), l2 === 0)
    return { mode: "xyz50", x: 0, y: 0, z: 0 };
  u2 === void 0 && (u2 = 0), v2 === void 0 && (v2 = 0);
  let up = u2 / (13 * l2) + un2, vp = v2 / (13 * l2) + vn2, y3 = D50.Y * (l2 <= 8 ? l2 / k4 : Math.pow((l2 + 16) / 116, 3)), x3 = y3 * (9 * up) / (4 * vp), z = y3 * (12 - 3 * up - 20 * vp) / (4 * vp), res = { mode: "xyz50", x: x3, y: y3, z };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLuvToXyz50_default = convertLuvToXyz50;

// node_modules/culori/src/lchuv/definition.js
var convertRgbToLchuv = (rgb3) => convertLuvToLchuv_default(convertXyz50ToLuv_default(convertRgbToXyz50_default(rgb3))), convertLchuvToRgb = (lchuv2) => convertXyz50ToRgb_default(convertLuvToXyz50_default(convertLchuvToLuv_default(lchuv2))), definition17 = {
  mode: "lchuv",
  toMode: {
    luv: convertLchuvToLuv_default,
    rgb: convertLchuvToRgb
  },
  fromMode: {
    rgb: convertRgbToLchuv,
    luv: convertLuvToLchuv_default
  },
  channels: ["l", "c", "h", "alpha"],
  parse: ["--lchuv"],
  serialize: "--lchuv",
  ranges: {
    l: [0, 100],
    c: [0, 176.956],
    h: [0, 360]
  },
  interpolate: {
    h: { use: interpolatorLinear, fixup: fixupHueShorter },
    c: interpolatorLinear,
    l: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  },
  difference: {
    h: differenceHueChroma
  },
  average: {
    h: averageAngle
  }
}, definition_default17 = definition17;

// node_modules/culori/src/lrgb/definition.js
var definition18 = {
  ...definition_default,
  mode: "lrgb",
  toMode: {
    rgb: convertLrgbToRgb_default
  },
  fromMode: {
    rgb: convertRgbToLrgb_default
  },
  parse: ["srgb-linear"],
  serialize: "srgb-linear"
}, definition_default18 = definition18;

// node_modules/culori/src/luv/definition.js
var definition19 = {
  mode: "luv",
  toMode: {
    xyz50: convertLuvToXyz50_default,
    rgb: (luv2) => convertXyz50ToRgb_default(convertLuvToXyz50_default(luv2))
  },
  fromMode: {
    xyz50: convertXyz50ToLuv_default,
    rgb: (rgb3) => convertXyz50ToLuv_default(convertRgbToXyz50_default(rgb3))
  },
  channels: ["l", "u", "v", "alpha"],
  parse: ["--luv"],
  serialize: "--luv",
  ranges: {
    l: [0, 100],
    u: [-84.936, 175.042],
    v: [-125.882, 87.243]
  },
  interpolate: {
    l: interpolatorLinear,
    u: interpolatorLinear,
    v: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default19 = definition19;

// node_modules/culori/src/oklab/convertLrgbToOklab.js
var convertLrgbToOklab = ({ r: r3, g: g2, b: b2, alpha }) => {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let L2 = Math.cbrt(
    0.412221469470763 * r3 + 0.5363325372617348 * g2 + 0.0514459932675022 * b2
  ), M3 = Math.cbrt(
    0.2119034958178252 * r3 + 0.6806995506452344 * g2 + 0.1073969535369406 * b2
  ), S2 = Math.cbrt(
    0.0883024591900564 * r3 + 0.2817188391361215 * g2 + 0.6299787016738222 * b2
  ), res = {
    mode: "oklab",
    l: 0.210454268309314 * L2 + 0.7936177747023054 * M3 - 0.0040720430116193 * S2,
    a: 1.9779985324311684 * L2 - 2.42859224204858 * M3 + 0.450593709617411 * S2,
    b: 0.0259040424655478 * L2 + 0.7827717124575296 * M3 - 0.8086757549230774 * S2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertLrgbToOklab_default = convertLrgbToOklab;

// node_modules/culori/src/oklab/convertRgbToOklab.js
var convertRgbToOklab = (rgb3) => {
  let res = convertLrgbToOklab_default(convertRgbToLrgb_default(rgb3));
  return rgb3.r === rgb3.b && rgb3.b === rgb3.g && (res.a = res.b = 0), res;
}, convertRgbToOklab_default = convertRgbToOklab;

// node_modules/culori/src/oklab/convertOklabToLrgb.js
var convertOklabToLrgb = ({ l: l2, a: a2, b: b2, alpha }) => {
  l2 === void 0 && (l2 = 0), a2 === void 0 && (a2 = 0), b2 === void 0 && (b2 = 0);
  let L2 = Math.pow(l2 + 0.3963377773761749 * a2 + 0.2158037573099136 * b2, 3), M3 = Math.pow(l2 - 0.1055613458156586 * a2 - 0.0638541728258133 * b2, 3), S2 = Math.pow(l2 - 0.0894841775298119 * a2 - 1.2914855480194092 * b2, 3), res = {
    mode: "lrgb",
    r: 4.076741636075957 * L2 - 3.3077115392580616 * M3 + 0.2309699031821044 * S2,
    g: -1.2684379732850317 * L2 + 2.6097573492876887 * M3 - 0.3413193760026573 * S2,
    b: -0.0041960761386756 * L2 - 0.7034186179359362 * M3 + 1.7076146940746117 * S2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertOklabToLrgb_default = convertOklabToLrgb;

// node_modules/culori/src/oklab/convertOklabToRgb.js
var convertOklabToRgb = (c3) => convertLrgbToRgb_default(convertOklabToLrgb_default(c3)), convertOklabToRgb_default = convertOklabToRgb;

// node_modules/culori/src/okhsl/helpers.js
function toe(x3) {
  let k_3 = 1.170873786407767;
  return 0.5 * (k_3 * x3 - 0.206 + Math.sqrt((k_3 * x3 - 0.206) * (k_3 * x3 - 0.206) + 4 * 0.03 * k_3 * x3));
}
function toe_inv(x3) {
  return (x3 * x3 + 0.206 * x3) / (1.170873786407767 * (x3 + 0.03));
}
function compute_max_saturation(a2, b2) {
  let k0, k1, k22, k32, k42, wl, wm, ws;
  -1.88170328 * a2 - 0.80936493 * b2 > 1 ? (k0 = 1.19086277, k1 = 1.76576728, k22 = 0.59662641, k32 = 0.75515197, k42 = 0.56771245, wl = 4.0767416621, wm = -3.3077115913, ws = 0.2309699292) : 1.81444104 * a2 - 1.19445276 * b2 > 1 ? (k0 = 0.73956515, k1 = -0.45954404, k22 = 0.08285427, k32 = 0.1254107, k42 = 0.14503204, wl = -1.2684380046, wm = 2.6097574011, ws = -0.3413193965) : (k0 = 1.35733652, k1 = -915799e-8, k22 = -1.1513021, k32 = -0.50559606, k42 = 692167e-8, wl = -0.0041960863, wm = -0.7034186147, ws = 1.707614701);
  let S2 = k0 + k1 * a2 + k22 * b2 + k32 * a2 * a2 + k42 * a2 * b2, k_l = 0.3963377774 * a2 + 0.2158037573 * b2, k_m = -0.1055613458 * a2 - 0.0638541728 * b2, k_s = -0.0894841775 * a2 - 1.291485548 * b2;
  {
    let l_ = 1 + S2 * k_l, m_ = 1 + S2 * k_m, s_ = 1 + S2 * k_s, l2 = l_ * l_ * l_, m2 = m_ * m_ * m_, s2 = s_ * s_ * s_, l_dS = 3 * k_l * l_ * l_, m_dS = 3 * k_m * m_ * m_, s_dS = 3 * k_s * s_ * s_, l_dS2 = 6 * k_l * k_l * l_, m_dS2 = 6 * k_m * k_m * m_, s_dS2 = 6 * k_s * k_s * s_, f4 = wl * l2 + wm * m2 + ws * s2, f1 = wl * l_dS + wm * m_dS + ws * s_dS, f22 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;
    S2 = S2 - f4 * f1 / (f1 * f1 - 0.5 * f4 * f22);
  }
  return S2;
}
function find_cusp(a2, b2) {
  let S_cusp = compute_max_saturation(a2, b2), rgb3 = convertOklabToLrgb_default({ l: 1, a: S_cusp * a2, b: S_cusp * b2 }), L_cusp = Math.cbrt(1 / Math.max(rgb3.r, rgb3.g, rgb3.b)), C_cusp = L_cusp * S_cusp;
  return [L_cusp, C_cusp];
}
function find_gamut_intersection(a2, b2, L1, C12, L0, cusp = null) {
  cusp || (cusp = find_cusp(a2, b2));
  let t3;
  if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C12 <= 0)
    t3 = cusp[1] * L0 / (C12 * cusp[0] + cusp[1] * (L0 - L1));
  else {
    t3 = cusp[1] * (L0 - 1) / (C12 * (cusp[0] - 1) + cusp[1] * (L0 - L1));
    {
      let dL = L1 - L0, dC = C12, k_l = 0.3963377774 * a2 + 0.2158037573 * b2, k_m = -0.1055613458 * a2 - 0.0638541728 * b2, k_s = -0.0894841775 * a2 - 1.291485548 * b2, l_dt = dL + dC * k_l, m_dt = dL + dC * k_m, s_dt = dL + dC * k_s;
      {
        let L2 = L0 * (1 - t3) + t3 * L1, C4 = t3 * C12, l_ = L2 + C4 * k_l, m_ = L2 + C4 * k_m, s_ = L2 + C4 * k_s, l2 = l_ * l_ * l_, m2 = m_ * m_ * m_, s2 = s_ * s_ * s_, ldt = 3 * l_dt * l_ * l_, mdt = 3 * m_dt * m_ * m_, sdt = 3 * s_dt * s_ * s_, ldt2 = 6 * l_dt * l_dt * l_, mdt2 = 6 * m_dt * m_dt * m_, sdt2 = 6 * s_dt * s_dt * s_, r3 = 4.0767416621 * l2 - 3.3077115913 * m2 + 0.2309699292 * s2 - 1, r1 = 4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt, r22 = 4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2, u_r = r1 / (r1 * r1 - 0.5 * r3 * r22), t_r = -r3 * u_r, g2 = -1.2684380046 * l2 + 2.6097574011 * m2 - 0.3413193965 * s2 - 1, g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt, g22 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2, u_g = g1 / (g1 * g1 - 0.5 * g2 * g22), t_g = -g2 * u_g, b3 = -0.0041960863 * l2 - 0.7034186147 * m2 + 1.707614701 * s2 - 1, b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.707614701 * sdt, b22 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.707614701 * sdt2, u_b = b1 / (b1 * b1 - 0.5 * b3 * b22), t_b = -b3 * u_b;
        t_r = u_r >= 0 ? t_r : 1e6, t_g = u_g >= 0 ? t_g : 1e6, t_b = u_b >= 0 ? t_b : 1e6, t3 += Math.min(t_r, Math.min(t_g, t_b));
      }
    }
  }
  return t3;
}
function get_ST_max(a_, b_, cusp = null) {
  cusp || (cusp = find_cusp(a_, b_));
  let L2 = cusp[0], C4 = cusp[1];
  return [C4 / L2, C4 / (1 - L2)];
}
function get_Cs(L2, a_, b_) {
  let cusp = find_cusp(a_, b_), C_max = find_gamut_intersection(a_, b_, L2, 1, L2, cusp), ST_max = get_ST_max(a_, b_, cusp), S_mid = 0.11516993 + 1 / (7.4477897 + 4.1590124 * b_ + a_ * (-2.19557347 + 1.75198401 * b_ + a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_)))), T_mid = 0.11239642 + 1 / (1.6132032 - 0.68124379 * b_ + a_ * (0.40370612 + 0.90148123 * b_ + a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (299215e-8 - 0.45399568 * b_ - 0.14661872 * a_)))), k5 = C_max / Math.min(L2 * ST_max[0], (1 - L2) * ST_max[1]), C_a = L2 * S_mid, C_b = (1 - L2) * T_mid, C_mid = 0.9 * k5 * Math.sqrt(
    Math.sqrt(
      1 / (1 / (C_a * C_a * C_a * C_a) + 1 / (C_b * C_b * C_b * C_b))
    )
  );
  return C_a = L2 * 0.4, C_b = (1 - L2) * 0.8, [Math.sqrt(1 / (1 / (C_a * C_a) + 1 / (C_b * C_b))), C_mid, C_max];
}

// node_modules/culori/src/okhsl/convertOklabToOkhsl.js
function convertOklabToOkhsl(lab2) {
  let l2 = lab2.l !== void 0 ? lab2.l : 0, a2 = lab2.a !== void 0 ? lab2.a : 0, b2 = lab2.b !== void 0 ? lab2.b : 0, ret = { mode: "okhsl", l: toe(l2) };
  lab2.alpha !== void 0 && (ret.alpha = lab2.alpha);
  let c3 = Math.sqrt(a2 * a2 + b2 * b2);
  if (!c3)
    return ret.s = 0, ret;
  let [C_0, C_mid, C_max] = get_Cs(l2, a2 / c3, b2 / c3), s2;
  if (c3 < C_mid) {
    let k_0 = 0, k_1 = 0.8 * C_0, k_2 = 1 - k_1 / C_mid;
    s2 = (c3 - k_0) / (k_1 + k_2 * (c3 - k_0)) * 0.8;
  } else {
    let k_0 = C_mid, k_1 = 0.2 * C_mid * C_mid * 1.25 * 1.25 / C_0, k_2 = 1 - k_1 / (C_max - C_mid);
    s2 = 0.8 + 0.2 * ((c3 - k_0) / (k_1 + k_2 * (c3 - k_0)));
  }
  return s2 && (ret.s = s2, ret.h = normalizeHue_default(Math.atan2(b2, a2) * 180 / Math.PI)), ret;
}

// node_modules/culori/src/okhsl/convertOkhslToOklab.js
function convertOkhslToOklab(hsl3) {
  let h2 = hsl3.h !== void 0 ? hsl3.h : 0, s2 = hsl3.s !== void 0 ? hsl3.s : 0, l2 = hsl3.l !== void 0 ? hsl3.l : 0, ret = { mode: "oklab", l: toe_inv(l2) };
  if (hsl3.alpha !== void 0 && (ret.alpha = hsl3.alpha), !s2 || l2 === 1)
    return ret.a = ret.b = 0, ret;
  let a_ = Math.cos(h2 / 180 * Math.PI), b_ = Math.sin(h2 / 180 * Math.PI), [C_0, C_mid, C_max] = get_Cs(ret.l, a_, b_), t3, k_0, k_1, k_2;
  s2 < 0.8 ? (t3 = 1.25 * s2, k_0 = 0, k_1 = 0.8 * C_0, k_2 = 1 - k_1 / C_mid) : (t3 = 5 * (s2 - 0.8), k_0 = C_mid, k_1 = 0.2 * C_mid * C_mid * 1.25 * 1.25 / C_0, k_2 = 1 - k_1 / (C_max - C_mid));
  let C4 = k_0 + t3 * k_1 / (1 - k_2 * t3);
  return ret.a = C4 * a_, ret.b = C4 * b_, ret;
}

// node_modules/culori/src/okhsl/modeOkhsl.js
var modeOkhsl = {
  ...definition_default7,
  mode: "okhsl",
  channels: ["h", "s", "l", "alpha"],
  parse: ["--okhsl"],
  serialize: "--okhsl",
  fromMode: {
    oklab: convertOklabToOkhsl,
    rgb: (c3) => convertOklabToOkhsl(convertRgbToOklab_default(c3))
  },
  toMode: {
    oklab: convertOkhslToOklab,
    rgb: (c3) => convertOklabToRgb_default(convertOkhslToOklab(c3))
  }
}, modeOkhsl_default = modeOkhsl;

// node_modules/culori/src/okhsv/convertOklabToOkhsv.js
function convertOklabToOkhsv(lab2) {
  let l2 = lab2.l !== void 0 ? lab2.l : 0, a2 = lab2.a !== void 0 ? lab2.a : 0, b2 = lab2.b !== void 0 ? lab2.b : 0, c3 = Math.sqrt(a2 * a2 + b2 * b2), a_ = c3 ? a2 / c3 : 1, b_ = c3 ? b2 / c3 : 1, [S_max, T2] = get_ST_max(a_, b_), S_0 = 0.5, k5 = 1 - S_0 / S_max, t3 = T2 / (c3 + l2 * T2), L_v = t3 * l2, C_v = t3 * c3, L_vt = toe_inv(L_v), C_vt = C_v * L_vt / L_v, rgb_scale = convertOklabToLrgb_default({ l: L_vt, a: a_ * C_vt, b: b_ * C_vt }), scale_L = Math.cbrt(
    1 / Math.max(rgb_scale.r, rgb_scale.g, rgb_scale.b, 0)
  );
  l2 = l2 / scale_L, c3 = c3 / scale_L * toe(l2) / l2, l2 = toe(l2);
  let ret = {
    mode: "okhsv",
    s: c3 ? (S_0 + T2) * C_v / (T2 * S_0 + T2 * k5 * C_v) : 0,
    v: l2 ? l2 / L_v : 0
  };
  return ret.s && (ret.h = normalizeHue_default(Math.atan2(b2, a2) * 180 / Math.PI)), lab2.alpha !== void 0 && (ret.alpha = lab2.alpha), ret;
}

// node_modules/culori/src/okhsv/convertOkhsvToOklab.js
function convertOkhsvToOklab(hsv2) {
  let ret = { mode: "oklab" };
  hsv2.alpha !== void 0 && (ret.alpha = hsv2.alpha);
  let h2 = hsv2.h !== void 0 ? hsv2.h : 0, s2 = hsv2.s !== void 0 ? hsv2.s : 0, v2 = hsv2.v !== void 0 ? hsv2.v : 0, a_ = Math.cos(h2 / 180 * Math.PI), b_ = Math.sin(h2 / 180 * Math.PI), [S_max, T2] = get_ST_max(a_, b_), S_0 = 0.5, k5 = 1 - S_0 / S_max, L_v = 1 - s2 * S_0 / (S_0 + T2 - T2 * k5 * s2), C_v = s2 * T2 * S_0 / (S_0 + T2 - T2 * k5 * s2), L_vt = toe_inv(L_v), C_vt = C_v * L_vt / L_v, rgb_scale = convertOklabToLrgb_default({
    l: L_vt,
    a: a_ * C_vt,
    b: b_ * C_vt
  }), scale_L = Math.cbrt(
    1 / Math.max(rgb_scale.r, rgb_scale.g, rgb_scale.b, 0)
  ), L_new = toe_inv(v2 * L_v), C4 = C_v * L_new / L_v;
  return ret.l = L_new * scale_L, ret.a = C4 * a_ * scale_L, ret.b = C4 * b_ * scale_L, ret;
}

// node_modules/culori/src/okhsv/modeOkhsv.js
var modeOkhsv = {
  ...definition_default8,
  mode: "okhsv",
  channels: ["h", "s", "v", "alpha"],
  parse: ["--okhsv"],
  serialize: "--okhsv",
  fromMode: {
    oklab: convertOklabToOkhsv,
    rgb: (c3) => convertOklabToOkhsv(convertRgbToOklab_default(c3))
  },
  toMode: {
    oklab: convertOkhsvToOklab,
    rgb: (c3) => convertOklabToRgb_default(convertOkhsvToOklab(c3))
  }
}, modeOkhsv_default = modeOkhsv;

// node_modules/culori/src/oklab/parseOklab.js
function parseOklab(color, parsed) {
  if (!parsed || parsed[0] !== "oklab")
    return;
  let res = { mode: "oklab" }, [, l2, a2, b2, alpha] = parsed;
  if (!(l2.type === Tok.Hue || a2.type === Tok.Hue || b2.type === Tok.Hue))
    return l2.type !== Tok.None && (res.l = Math.min(
      Math.max(0, l2.type === Tok.Number ? l2.value : l2.value / 100),
      1
    )), a2.type !== Tok.None && (res.a = a2.type === Tok.Number ? a2.value : a2.value * 0.4 / 100), b2.type !== Tok.None && (res.b = b2.type === Tok.Number ? b2.value : b2.value * 0.4 / 100), alpha.type !== Tok.None && (res.alpha = Math.min(
      1,
      Math.max(
        0,
        alpha.type === Tok.Number ? alpha.value : alpha.value / 100
      )
    )), res;
}
var parseOklab_default = parseOklab;

// node_modules/culori/src/oklab/definition.js
var definition20 = {
  ...definition_default13,
  mode: "oklab",
  toMode: {
    lrgb: convertOklabToLrgb_default,
    rgb: convertOklabToRgb_default
  },
  fromMode: {
    lrgb: convertLrgbToOklab_default,
    rgb: convertRgbToOklab_default
  },
  ranges: {
    l: [0, 1],
    a: [-0.4, 0.4],
    b: [-0.4, 0.4]
  },
  parse: [parseOklab_default],
  serialize: (c3) => `oklab(${c3.l !== void 0 ? c3.l : "none"} ${c3.a !== void 0 ? c3.a : "none"} ${c3.b !== void 0 ? c3.b : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`
}, definition_default20 = definition20;

// node_modules/culori/src/oklch/parseOklch.js
function parseOklch(color, parsed) {
  if (!parsed || parsed[0] !== "oklch")
    return;
  let res = { mode: "oklch" }, [, l2, c3, h2, alpha] = parsed;
  if (l2.type !== Tok.None) {
    if (l2.type === Tok.Hue)
      return;
    res.l = Math.min(
      Math.max(0, l2.type === Tok.Number ? l2.value : l2.value / 100),
      1
    );
  }
  if (c3.type !== Tok.None && (res.c = Math.max(
    0,
    c3.type === Tok.Number ? c3.value : c3.value * 0.4 / 100
  )), h2.type !== Tok.None) {
    if (h2.type === Tok.Percentage)
      return;
    res.h = h2.value;
  }
  return alpha.type !== Tok.None && (res.alpha = Math.min(
    1,
    Math.max(
      0,
      alpha.type === Tok.Number ? alpha.value : alpha.value / 100
    )
  )), res;
}
var parseOklch_default = parseOklch;

// node_modules/culori/src/oklch/definition.js
var definition21 = {
  ...definition_default15,
  mode: "oklch",
  toMode: {
    oklab: (c3) => convertLchToLab_default(c3, "oklab"),
    rgb: (c3) => convertOklabToRgb_default(convertLchToLab_default(c3, "oklab"))
  },
  fromMode: {
    rgb: (c3) => convertLabToLch_default(convertRgbToOklab_default(c3), "oklch"),
    oklab: (c3) => convertLabToLch_default(c3, "oklch")
  },
  parse: [parseOklch_default],
  serialize: (c3) => `oklch(${c3.l !== void 0 ? c3.l : "none"} ${c3.c !== void 0 ? c3.c : "none"} ${c3.h !== void 0 ? c3.h : "none"}${c3.alpha < 1 ? ` / ${c3.alpha}` : ""})`,
  ranges: {
    l: [0, 1],
    c: [0, 0.4],
    h: [0, 360]
  }
}, definition_default21 = definition21;

// node_modules/culori/src/p3/convertP3ToXyz65.js
var convertP3ToXyz65 = (rgb3) => {
  let { r: r3, g: g2, b: b2, alpha } = convertRgbToLrgb_default(rgb3), res = {
    mode: "xyz65",
    x: 0.486570948648216 * r3 + 0.265667693169093 * g2 + 0.1982172852343625 * b2,
    y: 0.2289745640697487 * r3 + 0.6917385218365062 * g2 + 0.079286914093745 * b2,
    z: 0 * r3 + 0.0451133818589026 * g2 + 1.043944368900976 * b2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertP3ToXyz65_default = convertP3ToXyz65;

// node_modules/culori/src/p3/convertXyz65ToP3.js
var convertXyz65ToP3 = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = convertLrgbToRgb_default(
    {
      r: x3 * 2.4934969119414263 - y3 * 0.9313836179191242 - 0.402710784450717 * z,
      g: x3 * -0.8294889695615749 + y3 * 1.7626640603183465 + 0.0236246858419436 * z,
      b: x3 * 0.0358458302437845 - y3 * 0.0761723892680418 + 0.9568845240076871 * z
    },
    "p3"
  );
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToP3_default = convertXyz65ToP3;

// node_modules/culori/src/p3/definition.js
var definition22 = {
  ...definition_default,
  mode: "p3",
  parse: ["display-p3"],
  serialize: "display-p3",
  fromMode: {
    rgb: (color) => convertXyz65ToP3_default(convertRgbToXyz65_default(color)),
    xyz65: convertXyz65ToP3_default
  },
  toMode: {
    rgb: (color) => convertXyz65ToRgb_default(convertP3ToXyz65_default(color)),
    xyz65: convertP3ToXyz65_default
  }
}, definition_default22 = definition22;

// node_modules/culori/src/prophoto/convertXyz50ToProphoto.js
var gamma2 = (v2) => {
  let abs4 = Math.abs(v2);
  return abs4 >= 1953125e-9 ? Math.sign(v2) * Math.pow(abs4, 0.5555555555555556) : 16 * v2;
}, convertXyz50ToProphoto = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = {
    mode: "prophoto",
    r: gamma2(
      x3 * 1.3457868816471585 - y3 * 0.2555720873797946 - 0.0511018649755453 * z
    ),
    g: gamma2(
      x3 * -0.5446307051249019 + y3 * 1.5082477428451466 + 0.0205274474364214 * z
    ),
    b: gamma2(x3 * 0 + y3 * 0 + 1.2119675456389452 * z)
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz50ToProphoto_default = convertXyz50ToProphoto;

// node_modules/culori/src/prophoto/convertProphotoToXyz50.js
var linearize2 = (v2 = 0) => {
  let abs4 = Math.abs(v2);
  return abs4 >= 0.03125 ? Math.sign(v2) * Math.pow(abs4, 1.8) : v2 / 16;
}, convertProphotoToXyz50 = (prophoto2) => {
  let r3 = linearize2(prophoto2.r), g2 = linearize2(prophoto2.g), b2 = linearize2(prophoto2.b), res = {
    mode: "xyz50",
    x: 0.7977666449006423 * r3 + 0.1351812974005331 * g2 + 0.0313477341283922 * b2,
    y: 0.2880748288194013 * r3 + 0.7118352342418731 * g2 + 899369387256e-16 * b2,
    z: 0 * r3 + 0 * g2 + 0.8251046025104602 * b2
  };
  return prophoto2.alpha !== void 0 && (res.alpha = prophoto2.alpha), res;
}, convertProphotoToXyz50_default = convertProphotoToXyz50;

// node_modules/culori/src/prophoto/definition.js
var definition23 = {
  ...definition_default,
  mode: "prophoto",
  parse: ["prophoto-rgb"],
  serialize: "prophoto-rgb",
  fromMode: {
    xyz50: convertXyz50ToProphoto_default,
    rgb: (color) => convertXyz50ToProphoto_default(convertRgbToXyz50_default(color))
  },
  toMode: {
    xyz50: convertProphotoToXyz50_default,
    rgb: (color) => convertXyz50ToRgb_default(convertProphotoToXyz50_default(color))
  }
}, definition_default23 = definition23;

// node_modules/culori/src/rec2020/convertXyz65ToRec2020.js
var \u03B1 = 1.09929682680944, \u03B2 = 0.018053968510807, gamma3 = (v2) => {
  let abs4 = Math.abs(v2);
  return abs4 > \u03B2 ? (Math.sign(v2) || 1) * (\u03B1 * Math.pow(abs4, 0.45) - (\u03B1 - 1)) : 4.5 * v2;
}, convertXyz65ToRec2020 = ({ x: x3, y: y3, z, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = {
    mode: "rec2020",
    r: gamma3(
      x3 * 1.7166511879712683 - y3 * 0.3556707837763925 - 0.2533662813736599 * z
    ),
    g: gamma3(
      x3 * -0.6666843518324893 + y3 * 1.6164812366349395 + 0.0157685458139111 * z
    ),
    b: gamma3(
      x3 * 0.0176398574453108 - y3 * 0.0427706132578085 + 0.9421031212354739 * z
    )
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToRec2020_default = convertXyz65ToRec2020;

// node_modules/culori/src/rec2020/convertRec2020ToXyz65.js
var \u03B12 = 1.09929682680944, \u03B22 = 0.018053968510807, linearize3 = (v2 = 0) => {
  let abs4 = Math.abs(v2);
  return abs4 < \u03B22 * 4.5 ? v2 / 4.5 : (Math.sign(v2) || 1) * Math.pow((abs4 + \u03B12 - 1) / \u03B12, 1 / 0.45);
}, convertRec2020ToXyz65 = (rec20202) => {
  let r3 = linearize3(rec20202.r), g2 = linearize3(rec20202.g), b2 = linearize3(rec20202.b), res = {
    mode: "xyz65",
    x: 0.6369580483012911 * r3 + 0.1446169035862083 * g2 + 0.1688809751641721 * b2,
    y: 0.262700212011267 * r3 + 0.6779980715188708 * g2 + 0.059301716469862 * b2,
    z: 0 * r3 + 0.0280726930490874 * g2 + 1.0609850577107909 * b2
  };
  return rec20202.alpha !== void 0 && (res.alpha = rec20202.alpha), res;
}, convertRec2020ToXyz65_default = convertRec2020ToXyz65;

// node_modules/culori/src/rec2020/definition.js
var definition24 = {
  ...definition_default,
  mode: "rec2020",
  fromMode: {
    xyz65: convertXyz65ToRec2020_default,
    rgb: (color) => convertXyz65ToRec2020_default(convertRgbToXyz65_default(color))
  },
  toMode: {
    xyz65: convertRec2020ToXyz65_default,
    rgb: (color) => convertXyz65ToRgb_default(convertRec2020ToXyz65_default(color))
  },
  parse: ["rec2020"],
  serialize: "rec2020"
}, definition_default24 = definition24;

// node_modules/culori/src/xyb/constants.js
var bias = 0.0037930732552754493, bias_cbrt = Math.cbrt(bias);

// node_modules/culori/src/xyb/convertRgbToXyb.js
var transfer = (v2) => Math.cbrt(v2) - bias_cbrt, convertRgbToXyb = (color) => {
  let { r: r3, g: g2, b: b2, alpha } = convertRgbToLrgb_default(color), l2 = transfer(0.3 * r3 + 0.622 * g2 + 0.078 * b2 + bias), m2 = transfer(0.23 * r3 + 0.692 * g2 + 0.078 * b2 + bias), s2 = transfer(
    0.2434226892454782 * r3 + 0.2047674442449682 * g2 + 0.5518098665095535 * b2 + bias
  ), res = {
    mode: "xyb",
    x: (l2 - m2) / 2,
    y: (l2 + m2) / 2,
    /* Apply default chroma from luma (subtract Y from B) */
    b: s2 - (l2 + m2) / 2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToXyb_default = convertRgbToXyb;

// node_modules/culori/src/xyb/convertXybToRgb.js
var transfer2 = (v2) => Math.pow(v2 + bias_cbrt, 3), convertXybToRgb = ({ x: x3, y: y3, b: b2, alpha }) => {
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), b2 === void 0 && (b2 = 0);
  let l2 = transfer2(x3 + y3) - bias, m2 = transfer2(y3 - x3) - bias, s2 = transfer2(b2 + y3) - bias, res = convertLrgbToRgb_default({
    r: 11.031566904639861 * l2 - 9.866943908131562 * m2 - 0.16462299650829934 * s2,
    g: -3.2541473810744237 * l2 + 4.418770377582723 * m2 - 0.16462299650829934 * s2,
    b: -3.6588512867136815 * l2 + 2.7129230459360922 * m2 + 1.9459282407775895 * s2
  });
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXybToRgb_default = convertXybToRgb;

// node_modules/culori/src/xyb/definition.js
var definition25 = {
  mode: "xyb",
  channels: ["x", "y", "b", "alpha"],
  parse: ["--xyb"],
  serialize: "--xyb",
  toMode: {
    rgb: convertXybToRgb_default
  },
  fromMode: {
    rgb: convertRgbToXyb_default
  },
  ranges: {
    x: [-0.0154, 0.0281],
    y: [0, 0.8453],
    b: [-0.2778, 0.388]
  },
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    b: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default25 = definition25;

// node_modules/culori/src/xyz50/definition.js
var definition26 = {
  mode: "xyz50",
  parse: ["xyz-d50"],
  serialize: "xyz-d50",
  toMode: {
    rgb: convertXyz50ToRgb_default,
    lab: convertXyz50ToLab_default
  },
  fromMode: {
    rgb: convertRgbToXyz50_default,
    lab: convertLabToXyz50_default
  },
  channels: ["x", "y", "z", "alpha"],
  ranges: {
    x: [0, 0.964],
    y: [0, 0.999],
    z: [0, 0.825]
  },
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    z: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default26 = definition26;

// node_modules/culori/src/xyz65/convertXyz65ToXyz50.js
var convertXyz65ToXyz50 = (xyz652) => {
  let { x: x3, y: y3, z, alpha } = xyz652;
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = {
    mode: "xyz50",
    x: 1.0479298208405488 * x3 + 0.0229467933410191 * y3 - 0.0501922295431356 * z,
    y: 0.0296278156881593 * x3 + 0.990434484573249 * y3 - 0.0170738250293851 * z,
    z: -0.0092430581525912 * x3 + 0.0150551448965779 * y3 + 0.7518742899580008 * z
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz65ToXyz50_default = convertXyz65ToXyz50;

// node_modules/culori/src/xyz65/convertXyz50ToXyz65.js
var convertXyz50ToXyz65 = (xyz502) => {
  let { x: x3, y: y3, z, alpha } = xyz502;
  x3 === void 0 && (x3 = 0), y3 === void 0 && (y3 = 0), z === void 0 && (z = 0);
  let res = {
    mode: "xyz65",
    x: 0.9554734527042182 * x3 - 0.0230985368742614 * y3 + 0.0632593086610217 * z,
    y: -0.0283697069632081 * x3 + 1.0099954580058226 * y3 + 0.021041398966943 * z,
    z: 0.0123140016883199 * x3 - 0.0205076964334779 * y3 + 1.3303659366080753 * z
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertXyz50ToXyz65_default = convertXyz50ToXyz65;

// node_modules/culori/src/xyz65/definition.js
var definition27 = {
  mode: "xyz65",
  toMode: {
    rgb: convertXyz65ToRgb_default,
    xyz50: convertXyz65ToXyz50_default
  },
  fromMode: {
    rgb: convertRgbToXyz65_default,
    xyz50: convertXyz50ToXyz65_default
  },
  ranges: {
    x: [0, 0.95],
    y: [0, 1],
    z: [0, 1.088]
  },
  channels: ["x", "y", "z", "alpha"],
  parse: ["xyz", "xyz-d65"],
  serialize: "xyz-d65",
  interpolate: {
    x: interpolatorLinear,
    y: interpolatorLinear,
    z: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default27 = definition27;

// node_modules/culori/src/yiq/convertRgbToYiq.js
var convertRgbToYiq = ({ r: r3, g: g2, b: b2, alpha }) => {
  r3 === void 0 && (r3 = 0), g2 === void 0 && (g2 = 0), b2 === void 0 && (b2 = 0);
  let res = {
    mode: "yiq",
    y: 0.29889531 * r3 + 0.58662247 * g2 + 0.11448223 * b2,
    i: 0.59597799 * r3 - 0.2741761 * g2 - 0.32180189 * b2,
    q: 0.21147017 * r3 - 0.52261711 * g2 + 0.31114694 * b2
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertRgbToYiq_default = convertRgbToYiq;

// node_modules/culori/src/yiq/convertYiqToRgb.js
var convertYiqToRgb = ({ y: y3, i: i2, q, alpha }) => {
  y3 === void 0 && (y3 = 0), i2 === void 0 && (i2 = 0), q === void 0 && (q = 0);
  let res = {
    mode: "rgb",
    r: y3 + 0.95608445 * i2 + 0.6208885 * q,
    g: y3 - 0.27137664 * i2 - 0.6486059 * q,
    b: y3 - 1.10561724 * i2 + 1.70250126 * q
  };
  return alpha !== void 0 && (res.alpha = alpha), res;
}, convertYiqToRgb_default = convertYiqToRgb;

// node_modules/culori/src/yiq/definition.js
var definition28 = {
  mode: "yiq",
  toMode: {
    rgb: convertYiqToRgb_default
  },
  fromMode: {
    rgb: convertRgbToYiq_default
  },
  channels: ["y", "i", "q", "alpha"],
  parse: ["--yiq"],
  serialize: "--yiq",
  ranges: {
    i: [-0.595, 0.595],
    q: [-0.522, 0.522]
  },
  interpolate: {
    y: interpolatorLinear,
    i: interpolatorLinear,
    q: interpolatorLinear,
    alpha: { use: interpolatorLinear, fixup: fixupAlpha }
  }
}, definition_default28 = definition28;

// node_modules/culori/src/round.js
var r2 = (value, precision) => Math.round(value * (precision = Math.pow(10, precision))) / precision, round = (precision = 4) => (value) => typeof value == "number" ? r2(value, precision) : value, round_default = round;

// node_modules/culori/src/formatter.js
var twoDecimals = round_default(2), clamp = (value) => Math.max(0, Math.min(1, value || 0)), fixup = (value) => Math.round(clamp(value) * 255), rgb = converter_default("rgb"), hsl = converter_default("hsl"), serializeHex = (color) => {
  if (color === void 0)
    return;
  let r3 = fixup(color.r), g2 = fixup(color.g), b2 = fixup(color.b);
  return "#" + (1 << 24 | r3 << 16 | g2 << 8 | b2).toString(16).slice(1);
};
var formatHex = (c3) => serializeHex(rgb(c3));

// node_modules/culori/src/index.js
var a98 = useMode(definition_default2), cubehelix = useMode(definition_default3), dlab = useMode(definition_default4), dlch = useMode(definition_default5), hsi = useMode(definition_default6), hsl2 = useMode(definition_default7), hsv = useMode(definition_default8), hwb = useMode(definition_default9), itp = useMode(definition_default10), jab = useMode(definition_default11), jch = useMode(definition_default12), lab = useMode(definition_default13), lab65 = useMode(definition_default14), lch = useMode(definition_default15), lch65 = useMode(definition_default16), lchuv = useMode(definition_default17), lrgb = useMode(definition_default18), luv = useMode(definition_default19), okhsl = useMode(modeOkhsl_default), okhsv = useMode(modeOkhsv_default), oklab = useMode(definition_default20), oklch = useMode(definition_default21), p32 = useMode(definition_default22), prophoto = useMode(definition_default23), rec2020 = useMode(definition_default24), rgb2 = useMode(definition_default), xyb = useMode(definition_default25), xyz50 = useMode(definition_default26), xyz65 = useMode(definition_default27), yiq = useMode(definition_default28);

// lib/color.js
function mulberry322(seed) {
  let state = Math.abs(Math.floor(seed * 2147483647)) | 0;
  return () => {
    state = state + 1831565813 | 0;
    let t3 = Math.imul(state ^ state >>> 15, 1 | state);
    return t3 = t3 + Math.imul(t3 ^ t3 >>> 7, 61 | t3) ^ t3, ((t3 ^ t3 >>> 14) >>> 0) / 4294967296;
  };
}
function hashString2(s2) {
  let h2 = 0;
  for (let i2 = 0; i2 < s2.length; i2++)
    h2 = (h2 << 5) - h2 + s2.charCodeAt(i2) | 0;
  return Math.abs(h2) / 2147483648 % 1;
}
var paletteCache = /* @__PURE__ */ new Map(), MAX_CACHE_SIZE = 200;
function generatePalette(seed, options = {}) {
  let cacheKey = JSON.stringify({ seed, ...options });
  if (paletteCache.has(cacheKey)) return paletteCache.get(cacheKey);
  let numSeed = typeof seed == "number" ? seed : hashString2(String(seed)), rng = mulberry322(numSeed), count = Math.max(1, Math.min(options.count ?? 5, 8)), mode = options.mode || "analogous", minLight = options.minLightness ?? 0.15, maxLight = options.maxLightness ?? 0.9, minChroma = options.minChroma ?? 0.02, maxChroma = options.maxChroma ?? 0.18, baseHue;
  if (options.baseColor && typeof options.baseColor == "string") {
    let parsed = parse_default(options.baseColor);
    parsed ? baseHue = oklch(parsed).h ?? rng() * 360 : baseHue = rng() * 360;
  } else
    baseHue = rng() * 360;
  let colors = [];
  switch (mode) {
    case "complementary":
      if (colors.push(oklchColor(baseHue, maxLight, maxChroma)), colors.push(oklchColor((baseHue + 180) % 360, minLight + (maxLight - minLight) * 0.5, minChroma + (maxChroma - minChroma) * 0.6)), count > 2)
        for (let i2 = 2; i2 < count; i2++) {
          let t3 = i2 / (count - 1);
          colors.push(oklchColor(
            (baseHue + 30 + (rng() - 0.5) * 60) % 360,
            minLight + (maxLight - minLight) * (0.3 + t3 * 0.7),
            minChroma + (maxChroma - minChroma) * (0.2 + t3 * 0.5)
          ));
        }
      break;
    case "triadic":
      for (let i2 = 0; i2 < count; i2++) {
        let hue3 = (baseHue + i2 * 120) % 360, lightness = minLight + (maxLight - minLight) * ((i2 + 1) / (count + 1));
        colors.push(oklchColor(hue3, lightness, maxChroma));
      }
      break;
    case "tetradic":
      for (let i2 = 0; i2 < count; i2++) {
        let hue3 = (baseHue + i2 * 90) % 360;
        colors.push(oklchColor(
          hue3,
          minLight + (maxLight - minLight) * (0.3 + rng() * 0.7),
          minChroma + (maxChroma - minChroma) * (0.5 + rng() * 0.5)
        ));
      }
      break;
    case "monochromatic":
      for (let i2 = 0; i2 < count; i2++) {
        let t3 = i2 / Math.max(1, count - 1);
        colors.push(oklchColor(
          baseHue + (rng() - 0.5) * 15,
          minLight + (maxLight - minLight) * t3,
          minChroma + (maxChroma - minChroma) * (0.3 + rng() * 0.4)
        ));
      }
      break;
    case "analogous":
    default:
      let spread = 60;
      for (let i2 = 0; i2 < count; i2++) {
        let t3 = i2 / Math.max(1, count - 1), hue3 = (baseHue + (t3 - 0.5) * spread) % 360;
        colors.push(oklchColor(
          hue3,
          minLight + (maxLight - minLight) * (0.2 + t3 * 0.8),
          minChroma + (maxChroma - minChroma) * (0.5 + rng() * 0.5)
        ));
      }
      break;
  }
  let hexColors = colors.map((c3) => {
    try {
      return formatHex(c3) || "#4f8cff";
    } catch {
      return "#4f8cff";
    }
  });
  if (paletteCache.size >= MAX_CACHE_SIZE) {
    let firstKey = paletteCache.keys().next().value;
    paletteCache.delete(firstKey);
  }
  return paletteCache.set(cacheKey, hexColors), hexColors;
}
function oklchColor(h2, l2, c3) {
  return oklch({
    mode: "oklch",
    l: Math.max(0, Math.min(1, l2)),
    c: Math.max(0, Math.min(0.4, c3)),
    h: (h2 % 360 + 360) % 360
  });
}
function adjustLightness(hex2, amount) {
  try {
    let parsed = parse_default(hex2);
    if (!parsed) return hex2;
    let oklch2 = oklch(parsed);
    return oklch2.l = Math.max(0, Math.min(1, oklch2.l + amount)), formatHex(oklch2) || hex2;
  } catch {
    let v2 = Number.parseInt(hex2.slice(1), 16);
    if (isNaN(v2)) return hex2;
    let adjust = Math.round(amount * 255), r3 = Math.max(0, Math.min(255, (v2 >> 16 & 255) + adjust)), g2 = Math.max(0, Math.min(255, (v2 >> 8 & 255) + adjust)), b2 = Math.max(0, Math.min(255, (v2 & 255) + adjust));
    return `#${r3.toString(16).padStart(2, "0")}${g2.toString(16).padStart(2, "0")}${b2.toString(16).padStart(2, "0")}`;
  }
}
function mixColors(hex1, hex2, t3 = 0.5) {
  try {
    let c1 = parse_default(hex1), c22 = parse_default(hex2);
    if (!c1 || !c22) return hex1;
    let oklch1 = oklch(c1), oklch2 = oklch(c22), mixed = oklch({
      mode: "oklch",
      l: oklch1.l + (oklch2.l - oklch1.l) * t3,
      c: oklch1.c + (oklch2.c - oklch1.c) * t3,
      h: oklch1.h + (oklch2.h - oklch1.h) * t3
    });
    return formatHex(mixed) || hex1;
  } catch {
    return hex1;
  }
}
function colorTemperature(hex2) {
  try {
    let parsed = parse_default(hex2);
    if (!parsed) return "neutral";
    let h2 = ((oklch(parsed).h ?? 0) % 360 + 360) % 360;
    return h2 >= 20 && h2 <= 150 ? "warm" : h2 >= 190 && h2 <= 310 ? "cool" : "neutral";
  } catch {
    return "neutral";
  }
}
function temperaturePair(hex2, seed = 0) {
  let numSeed = typeof seed == "number" ? seed : hashString2(String(seed)), temp = colorTemperature(hex2);
  try {
    let parsed = parse_default(hex2);
    if (!parsed) return { warm: hex2, cool: hex2 };
    let oklch2 = oklch(parsed), warm = { ...oklch2, h: temp === "warm" ? oklch2.h : (oklch2.h + 120 + numSeed * 40) % 360 }, cool = { ...oklch2, h: temp === "cool" ? oklch2.h : (oklch2.h - 120 + numSeed * 40) % 360 };
    return {
      warm: formatHex(oklch(warm)) || hex2,
      cool: formatHex(oklch(cool)) || hex2
    };
  } catch {
    return { warm: hex2, cool: hex2 };
  }
}
function isValidHex(value) {
  return typeof value != "string" ? !1 : /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}
function toHex(color) {
  try {
    let parsed = parse_default(color);
    return parsed ? formatHex(parsed) : null;
  } catch {
    return null;
  }
}

// node_modules/simplex-noise/dist/esm/simplex-noise.js
var SQRT3 = /* @__PURE__ */ Math.sqrt(3), SQRT5 = /* @__PURE__ */ Math.sqrt(5), F2 = 0.5 * (SQRT3 - 1), G2 = (3 - SQRT3) / 6, F3 = 1 / 3, G3 = 1 / 6, F4 = (SQRT5 - 1) / 4, G4 = (5 - SQRT5) / 20, fastFloor = (x3) => Math.floor(x3) | 0, grad2 = /* @__PURE__ */ new Float64Array([
  1,
  1,
  -1,
  1,
  1,
  -1,
  -1,
  -1,
  1,
  0,
  -1,
  0,
  1,
  0,
  -1,
  0,
  0,
  1,
  0,
  -1,
  0,
  1,
  0,
  -1
]), grad3 = /* @__PURE__ */ new Float64Array([
  1,
  1,
  0,
  -1,
  1,
  0,
  1,
  -1,
  0,
  -1,
  -1,
  0,
  1,
  0,
  1,
  -1,
  0,
  1,
  1,
  0,
  -1,
  -1,
  0,
  -1,
  0,
  1,
  1,
  0,
  -1,
  1,
  0,
  1,
  -1,
  0,
  -1,
  -1
]);
function createNoise2D(random = Math.random) {
  let perm = buildPermutationTable(random), permGrad2x = new Float64Array(perm).map((v2) => grad2[v2 % 12 * 2]), permGrad2y = new Float64Array(perm).map((v2) => grad2[v2 % 12 * 2 + 1]);
  return function(x3, y3) {
    let n0 = 0, n1 = 0, n2 = 0, s2 = (x3 + y3) * F2, i2 = fastFloor(x3 + s2), j2 = fastFloor(y3 + s2), t3 = (i2 + j2) * G2, X0 = i2 - t3, Y0 = j2 - t3, x0 = x3 - X0, y0 = y3 - Y0, i1, j1;
    x0 > y0 ? (i1 = 1, j1 = 0) : (i1 = 0, j1 = 1);
    let x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x22 = x0 - 1 + 2 * G2, y22 = y0 - 1 + 2 * G2, ii = i2 & 255, jj = j2 & 255, t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      let gi0 = ii + perm[jj], g0x = permGrad2x[gi0], g0y = permGrad2y[gi0];
      t0 *= t0, n0 = t0 * t0 * (g0x * x0 + g0y * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      let gi1 = ii + i1 + perm[jj + j1], g1x = permGrad2x[gi1], g1y = permGrad2y[gi1];
      t1 *= t1, n1 = t1 * t1 * (g1x * x1 + g1y * y1);
    }
    let t22 = 0.5 - x22 * x22 - y22 * y22;
    if (t22 >= 0) {
      let gi2 = ii + 1 + perm[jj + 1], g2x = permGrad2x[gi2], g2y = permGrad2y[gi2];
      t22 *= t22, n2 = t22 * t22 * (g2x * x22 + g2y * y22);
    }
    return 70 * (n0 + n1 + n2);
  };
}
function createNoise3D(random = Math.random) {
  let perm = buildPermutationTable(random), permGrad3x = new Float64Array(perm).map((v2) => grad3[v2 % 12 * 3]), permGrad3y = new Float64Array(perm).map((v2) => grad3[v2 % 12 * 3 + 1]), permGrad3z = new Float64Array(perm).map((v2) => grad3[v2 % 12 * 3 + 2]);
  return function(x3, y3, z) {
    let n0, n1, n2, n3, s2 = (x3 + y3 + z) * F3, i2 = fastFloor(x3 + s2), j2 = fastFloor(y3 + s2), k5 = fastFloor(z + s2), t3 = (i2 + j2 + k5) * G3, X0 = i2 - t3, Y0 = j2 - t3, Z0 = k5 - t3, x0 = x3 - X0, y0 = y3 - Y0, z0 = z - Z0, i1, j1, k1, i22, j22, k22;
    x0 >= y0 ? y0 >= z0 ? (i1 = 1, j1 = 0, k1 = 0, i22 = 1, j22 = 1, k22 = 0) : x0 >= z0 ? (i1 = 1, j1 = 0, k1 = 0, i22 = 1, j22 = 0, k22 = 1) : (i1 = 0, j1 = 0, k1 = 1, i22 = 1, j22 = 0, k22 = 1) : y0 < z0 ? (i1 = 0, j1 = 0, k1 = 1, i22 = 0, j22 = 1, k22 = 1) : x0 < z0 ? (i1 = 0, j1 = 1, k1 = 0, i22 = 0, j22 = 1, k22 = 1) : (i1 = 0, j1 = 1, k1 = 0, i22 = 1, j22 = 1, k22 = 0);
    let x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x22 = x0 - i22 + 2 * G3, y22 = y0 - j22 + 2 * G3, z2 = z0 - k22 + 2 * G3, x32 = x0 - 1 + 3 * G3, y32 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3, ii = i2 & 255, jj = j2 & 255, kk = k5 & 255, t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0)
      n0 = 0;
    else {
      let gi0 = ii + perm[jj + perm[kk]];
      t0 *= t0, n0 = t0 * t0 * (permGrad3x[gi0] * x0 + permGrad3y[gi0] * y0 + permGrad3z[gi0] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0)
      n1 = 0;
    else {
      let gi1 = ii + i1 + perm[jj + j1 + perm[kk + k1]];
      t1 *= t1, n1 = t1 * t1 * (permGrad3x[gi1] * x1 + permGrad3y[gi1] * y1 + permGrad3z[gi1] * z1);
    }
    let t22 = 0.6 - x22 * x22 - y22 * y22 - z2 * z2;
    if (t22 < 0)
      n2 = 0;
    else {
      let gi2 = ii + i22 + perm[jj + j22 + perm[kk + k22]];
      t22 *= t22, n2 = t22 * t22 * (permGrad3x[gi2] * x22 + permGrad3y[gi2] * y22 + permGrad3z[gi2] * z2);
    }
    let t32 = 0.6 - x32 * x32 - y32 * y32 - z3 * z3;
    if (t32 < 0)
      n3 = 0;
    else {
      let gi3 = ii + 1 + perm[jj + 1 + perm[kk + 1]];
      t32 *= t32, n3 = t32 * t32 * (permGrad3x[gi3] * x32 + permGrad3y[gi3] * y32 + permGrad3z[gi3] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  };
}
function buildPermutationTable(random) {
  let p4 = new Uint8Array(512);
  for (let i2 = 0; i2 < 512 / 2; i2++)
    p4[i2] = i2;
  for (let i2 = 0; i2 < 512 / 2 - 1; i2++) {
    let r3 = i2 + ~~(random() * (256 - i2)), aux = p4[i2];
    p4[i2] = p4[r3], p4[r3] = aux;
  }
  for (let i2 = 256; i2 < 512; i2++)
    p4[i2] = p4[i2 - 256];
  return p4;
}

// lib/noise.js
var COORD_BOUND3 = 1e5, MAX_NOISE_CACHE = 100;
function clampC2(v2) {
  return Number.isFinite(v2) ? Math.max(-COORD_BOUND3, Math.min(COORD_BOUND3, v2)) : 0;
}
function hashString3(s2) {
  let h2 = 0;
  for (let i2 = 0; i2 < s2.length; i2++)
    h2 = (h2 << 5) - h2 + s2.charCodeAt(i2) | 0;
  return Math.abs(h2) / 2147483648 % 1;
}
var noise2DCache = /* @__PURE__ */ new Map(), noise3DCache = /* @__PURE__ */ new Map();
function getNoise2D(seed = 0) {
  let numSeed = typeof seed == "number" ? seed : hashString3(String(seed)), key = numSeed.toFixed(8);
  if (noise2DCache.has(key)) return noise2DCache.get(key);
  let noiseFn = createNoise2D(() => numSeed);
  return noise2DCache.size >= MAX_NOISE_CACHE && noise2DCache.delete(noise2DCache.keys().next().value), noise2DCache.set(key, noiseFn), noiseFn;
}
function getNoise3D(seed = 0) {
  let numSeed = typeof seed == "number" ? seed : hashString3(String(seed)), key = numSeed.toFixed(8);
  if (noise3DCache.has(key)) return noise3DCache.get(key);
  let noiseFn = createNoise3D(() => numSeed);
  return noise3DCache.size >= MAX_NOISE_CACHE && noise3DCache.delete(noise3DCache.keys().next().value), noise3DCache.set(key, noiseFn), noiseFn;
}
function paperGrain(x3, y3, seed = 0, frequency = 0.05) {
  let noise = getNoise2D(seed), nx = clampC2(x3) * frequency, ny = clampC2(y3) * frequency, v1 = noise(nx, ny) * 0.6, v2 = noise(nx * 2.3, ny * 2.3) * 0.25, v3 = noise(nx * 5.7, ny * 5.7) * 0.15;
  return (v1 + v2 + v3 + 1) / 2;
}
function inkTexture(x3, y3, seed = 0, frequency = 0.03) {
  let noise = getNoise3D(seed), nx = clampC2(x3) * frequency, ny = clampC2(y3) * frequency, nz = 0.5, v1 = noise(nx, ny, nz) * 0.5, v2 = noise(nx * 2.7, ny * 2.7, nz + 1.5) * 0.3, v3 = noise(nx * 6.1, ny * 6.1, nz + 3) * 0.2, val = (v1 + v2 + v3 + 1) / 2;
  return Math.pow(val, 1.5);
}
function perturb2D(x3, y3, seed = 0, amplitude = 2, frequency = 0.1) {
  let noiseX = getNoise2D(seed), noiseY = getNoise2D(typeof seed == "number" ? seed + 0.5 : hashString3(String(seed) + "_y")), dx = noiseX(clampC2(x3) * frequency, clampC2(y3) * frequency) * amplitude, dy = noiseY(clampC2(y3) * frequency, clampC2(x3) * frequency) * amplitude;
  return [clampC2(x3 + dx), clampC2(y3 + dy)];
}
function perturbPath(points, seed = 0, amplitude = 2, frequency = 0.1) {
  return Array.isArray(points) ? points.map(
    ([x3, y3], i2) => perturb2D(x3, y3, typeof seed == "number" ? seed + i2 * 0.01 : hashString3(String(seed) + "_" + i2), amplitude, frequency)
  ) : [];
}
function woodGrain(x3, y3, seed = 0, frequency = 0.02) {
  let noise = getNoise2D(seed), nx = clampC2(x3) * frequency, ny = clampC2(y3) * frequency, dist = Math.sqrt(nx * nx + ny * ny);
  return (Math.sin(dist * 10 + noise(nx * 2, ny * 2) * 2) + 1) / 2;
}
function cloudNoise(x3, y3, seed = 0, frequency = 0.01) {
  let noise = getNoise2D(seed), nx = clampC2(x3) * frequency, ny = clampC2(y3) * frequency, v1 = noise(nx, ny), v2 = noise(nx * 1.8 + 5.2, ny * 1.8 + 3.1), v3 = noise(nx * 3.5 + 1.7, ny * 3.5 + 8.4), val = Math.min(v1 * 0.5 + 0.5, v2 * 0.5 + 0.5);
  return val = Math.min(val, v3 * 0.5 + 0.5), Math.max(0, val);
}
function terrainNoise(x3, y3, seed = 0, frequency = 5e-3, octaves = 4) {
  let noise = getNoise2D(seed), nx = clampC2(x3) * frequency, ny = clampC2(y3) * frequency, val = 0, amp = 1, totalAmp = 0, f4 = 1;
  for (let i2 = 0; i2 < octaves; i2++)
    val += noise(nx * f4, ny * f4) * amp, totalAmp += amp, amp *= 0.5, f4 *= 2;
  return (val / totalAmp + 1) / 2;
}
function clearNoiseCache() {
  noise2DCache.clear(), noise3DCache.clear();
}

// lib/index.js
var ART_ENGINE_VERSION = "4.0.0", ART_ENGINE_BUILD = "__BUILD_TIMESTAMP__";
export {
  ART_ENGINE_BUILD,
  ART_ENGINE_VERSION,
  adjustLightness,
  bezierIntersections,
  bezierOffset,
  bezierSample,
  bezierSamples,
  bezierTangent,
  clampCoord,
  clampPoint,
  clampPoints,
  clearNoiseCache,
  cloudNoise,
  colorTemperature,
  freehandHatch,
  freehandStroke,
  generatePalette,
  getNoise2D,
  getNoise3D,
  inkTexture,
  isValidHex,
  mixColors,
  organicContour,
  organicCurve,
  paperGrain,
  perturb2D,
  perturbPath,
  smoothPoints,
  taperedBrushStroke,
  temperaturePair,
  terrainNoise,
  toHex,
  woodGrain
};
/* Art engine adapters ready. */
//# sourceMappingURL=art-engine.js.map
