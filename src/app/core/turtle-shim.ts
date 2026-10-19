/**
 * Modul `turtle` pro Pyodide. Nic nekreslí, jen zapisuje příkazy (`TurtleOp`), ze kterých
 * `opsToProgram` sestaví program pro TS interpret. Bloky i kód tak mají stejný trace.
 *
 * `run_student(code)` vrací JSON `PythonRunResult`.
 */
export const TURTLE_SHIM = `
import io
import json
import math
import sys
import traceback
import types

MAX_OPS = 5000
FILE = "<kód>"


class TurtleLimit(Exception):
    pass


class _State:
    def __init__(self):
        self.ops = []
        self.x = 0.0
        self.y = 0.0
        self.heading = 0.0
        self.down = True
        self.pen = "black"
        self.fill = "black"


_s = _State()


def _emit(*op):
    if len(_s.ops) >= MAX_OPS:
        raise TurtleLimit()
    _s.ops.append(list(op))


def _num(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError("čekalo se číslo, přišlo: " + repr(value))
    return float(value)


def _color(args):
    if len(args) == 1:
        value = args[0]
    elif len(args) == 3:
        value = tuple(args)
    else:
        raise TypeError("barva je text, nebo tři čísla")
    if isinstance(value, str):
        return value
    if isinstance(value, tuple) and len(value) == 3:
        scale = 1 if any(_num(c) > 1 for c in value) else 255
        return "#%02x%02x%02x" % tuple(round(_num(c) * scale) for c in value)
    raise TypeError("neznámá barva: " + repr(value))


def forward(distance):
    d = _num(distance)
    rad = math.radians(_s.heading)
    _s.x += d * math.cos(rad)
    _s.y += d * math.sin(rad)
    _emit("fd", d)


def backward(distance):
    forward(-_num(distance))


def left(angle):
    a = _num(angle)
    _s.heading = (_s.heading + a) % 360
    _emit("lt", a)


def right(angle):
    left(-_num(angle))


def setheading(angle):
    target = _num(angle) % 360
    delta = (target - _s.heading) % 360
    if delta:
        left(delta)


def penup():
    _s.down = False
    _emit("pu")


def pendown():
    _s.down = True
    _emit("pd")


def goto(x, y=None):
    if y is None:
        x, y = x
    _s.x, _s.y = _num(x), _num(y)
    _emit("goto", _s.x, _s.y)


def setx(x):
    goto(x, _s.y)


def sety(y):
    goto(_s.x, y)


def teleport(x=None, y=None, **_):
    was_down = _s.down
    if was_down:
        penup()
    goto(_s.x if x is None else x, _s.y if y is None else y)
    if was_down:
        pendown()


def home():
    goto(0, 0)
    setheading(0)


def circle(radius, extent=None, steps=None):
    r = _num(radius)
    ext = 360.0 if extent is None else _num(extent)
    if steps is None:
        frac = abs(ext) / 360
        steps = 1 + int(min(11 + abs(r) / 6.0, 59.0) * frac)
    w = ext / steps
    w2 = 0.5 * w
    length = 2.0 * r * math.sin(math.radians(w2))
    if r < 0:
        length, w, w2 = -length, -w, -w2
    left(w2)
    for _ in range(steps):
        forward(length)
        left(w)
    left(-w2)


def pencolor(*args):
    if not args:
        return _s.pen
    _s.pen = _color(args)
    _emit("color", _s.pen)


def fillcolor(*args):
    if not args:
        return _s.fill
    _s.fill = _color(args)


def color(*args):
    if not args:
        return _s.pen, _s.fill
    if len(args) == 2:
        pencolor(args[0])
        fillcolor(args[1])
    else:
        pencolor(*args)
        fillcolor(*args)


def begin_fill():
    _emit("begin_fill")


def end_fill():
    _emit("end_fill", _s.fill)


def clear():
    _s.ops.clear()
    _emit("pu")
    _emit("goto", _s.x, _s.y)
    if _s.heading:
        _emit("lt", _s.heading)
    if _s.down:
        _emit("pd")
    _emit("color", _s.pen)


def reset():
    _s.x = _s.y = _s.heading = 0.0
    _s.down = True
    _s.ops.clear()


def position():
    return (_s.x, _s.y)


def xcor():
    return _s.x


def ycor():
    return _s.y


def heading():
    return _s.heading


def isdown():
    return _s.down


def _noop(*_args, **_kwargs):
    return None


class _Screen:
    def __getattr__(self, _name):
        return _noop


def Screen():
    return _Screen()


_API = {
    "forward": forward, "fd": forward,
    "backward": backward, "back": backward, "bk": backward,
    "left": left, "lt": left, "right": right, "rt": right,
    "setheading": setheading, "seth": setheading,
    "penup": penup, "pu": penup, "up": penup,
    "pendown": pendown, "pd": pendown, "down": pendown,
    "goto": goto, "setpos": goto, "setposition": goto, "setx": setx, "sety": sety,
    "teleport": teleport, "home": home, "circle": circle,
    "pencolor": pencolor, "fillcolor": fillcolor, "color": color,
    "begin_fill": begin_fill, "end_fill": end_fill, "clear": clear, "reset": reset,
    "position": position, "pos": position, "xcor": xcor, "ycor": ycor,
    "heading": heading, "isdown": isdown,
}

# Okno, rychlost, tvar a tloušťka pera na hodnocení nemají vliv
_NOOPS = [
    "speed", "shape", "title", "setup", "pensize", "width", "exitonclick", "done", "mainloop",
    "hideturtle", "ht", "showturtle", "st", "tracer", "update", "bgcolor", "colormode",
    "delay", "shapesize", "turtlesize", "screensize",
]


class Turtle:
    def __init__(self, *_args, **_kwargs):
        pass


for _name, _fn in _API.items():
    setattr(Turtle, _name, (lambda fn: lambda self, *a, **k: fn(*a, **k))(_fn))
for _name in _NOOPS:
    setattr(Turtle, _name, lambda self, *a, **k: None)

_module = types.ModuleType("turtle")
for _name, _fn in _API.items():
    setattr(_module, _name, _fn)
for _name in _NOOPS:
    setattr(_module, _name, _noop)
_module.Turtle = Turtle
_module.Pen = Turtle
_module.Screen = Screen
sys.modules["turtle"] = _module


def run_student(code):
    reset()
    _s.pen = "black"
    _s.fill = "black"
    out = io.StringIO()
    old_out = sys.stdout
    sys.stdout = out
    error = None
    truncated = False
    try:
        exec(compile(code, FILE, "exec"), {"__name__": "__main__"})
    except TurtleLimit:
        truncated = True
    except SyntaxError as exc:
        error = {"type": "SyntaxError", "message": str(exc.msg), "line": exc.lineno}
    except BaseException as exc:
        line = None
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == FILE:
                line = frame.lineno
        error = {"type": type(exc).__name__, "message": str(exc), "line": line}
    finally:
        sys.stdout = old_out
    return json.dumps({"ops": _s.ops, "error": error, "truncated": truncated, "output": out.getvalue()})
`;
