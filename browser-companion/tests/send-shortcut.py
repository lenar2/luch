import ctypes,ctypes.util,time,sys
x=ctypes.CDLL(ctypes.util.find_library('X11'));t=ctypes.CDLL(ctypes.util.find_library('Xtst'))
x.XOpenDisplay.argtypes=[ctypes.c_char_p];x.XOpenDisplay.restype=ctypes.c_void_p
x.XStringToKeysym.argtypes=[ctypes.c_char_p];x.XStringToKeysym.restype=ctypes.c_ulong
x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XKeysymToKeycode.restype=ctypes.c_uint
t.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong];t.XTestFakeKeyEvent.restype=ctypes.c_int
x.XFlush.argtypes=[ctypes.c_void_p];x.XCloseDisplay.argtypes=[ctypes.c_void_p]
d=x.XOpenDisplay(None)
if not d:sys.exit('NO_DISPLAY')
keys=[]
for sym in ('Control_L','Shift_L','y'):
 c=x.XKeysymToKeycode(d,x.XStringToKeysym(sym.encode()))
 print('KEY',sym,c)
 if not c:sys.exit('KEY_NOT_FOUND')
 keys.append(c)
for c in keys:
 assert t.XTestFakeKeyEvent(d,c,1,0)==1
 x.XFlush(d);time.sleep(.075)
for c in reversed(keys):
 assert t.XTestFakeKeyEvent(d,c,0,0)==1
 x.XFlush(d);time.sleep(.075)
x.XCloseDisplay(d)
print('SENT_XTEST_KEYBOARD_SHORTCUT')

