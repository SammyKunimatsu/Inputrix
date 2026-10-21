import sys, json, time, random, threading, ctypes
from ctypes import wintypes

user32 = ctypes.WinDLL('user32', use_last_error=True)

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
MAPVK_VK_TO_VSC = 0

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_ABSOLUTE = 0x8000

EXTENDED_VKS = { 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0x6F, 0x90, 0xA3, 0xA5 }

ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong
io_lock = threading.Lock()
input_lock = threading.Lock()

class MOUSEINPUT(ctypes.Structure):
  _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('mouseData', wintypes.DWORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', ULONG_PTR)]

class KEYBDINPUT(ctypes.Structure):
  _fields_ = [('wVk', wintypes.WORD), ('wScan', wintypes.WORD), ('dwFlags', wintypes.DWORD), ('time', wintypes.DWORD), ('dwExtraInfo', ULONG_PTR)]

class HARDWAREINPUT(ctypes.Structure):
  _fields_ = [('uMsg', wintypes.DWORD), ('wParamL', wintypes.WORD), ('wParamH', wintypes.WORD)]

class INPUT_UNION(ctypes.Union):
  _fields_ = [('mi', MOUSEINPUT), ('ki', KEYBDINPUT), ('hi', HARDWAREINPUT)]

class INPUT(ctypes.Structure):
  _fields_ = [('type', wintypes.DWORD), ('union', INPUT_UNION)]

class POINT(ctypes.Structure):
  _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]

user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
user32.SendInput.restype = wintypes.UINT
user32.MapVirtualKeyW.argtypes = [wintypes.UINT, wintypes.UINT]
user32.MapVirtualKeyW.restype = wintypes.UINT
user32.WindowFromPoint.argtypes = [POINT]
user32.WindowFromPoint.restype = wintypes.HWND
user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
user32.GetAncestor.restype = wintypes.HWND

GA_ROOT = 2
safe_rects = []

def emit(data):
  with io_lock:
    sys.stdout.write(json.dumps(data) + '\n')
    sys.stdout.flush()

def get_cursor_pos():
  pt = POINT()
  user32.GetCursorPos(ctypes.byref(pt))
  return { 'x': pt.x, 'y': pt.y }

def is_cursor_over_app():
  pt = POINT()
  user32.GetCursorPos(ctypes.byref(pt))
  hwnd = user32.WindowFromPoint(pt)
  if hwnd:
    root = user32.GetAncestor(hwnd, GA_ROOT) or hwnd
    buf = ctypes.create_unicode_buffer(128)
    user32.GetWindowTextW(root, buf, 128)
    if buf.value in ('Inputrix', 'Inputrix Miniatura'): return True
  for r in safe_rects:
    if r['x'] <= pt.x <= r['x'] + r['width'] and r['y'] <= pt.y <= r['y'] + r['height']:
      return True
  return False

def _press_key_once(vk, scan, ext, is_up=False):
  up_flag = KEYEVENTF_KEYUP if is_up else 0
  inp_vk = INPUT(type=INPUT_KEYBOARD, union=INPUT_UNION(ki=KEYBDINPUT(wVk=vk, wScan=scan, dwFlags=(ext | up_flag), time=0, dwExtraInfo=0)))
  sent = user32.SendInput(1, ctypes.byref(inp_vk), ctypes.sizeof(INPUT))
  if sent == 0: user32.keybd_event(vk, scan, ext | up_flag, 0)

def send_key_hw(vk, hold_ms=75, interval_ms=1000):
  vk = int(vk)
  scan = user32.MapVirtualKeyW(vk, MAPVK_VK_TO_VSC)
  ext = KEYEVENTF_EXTENDEDKEY if vk in EXTENDED_VKS else 0
  effective_hold_ms = max(65.0, float(hold_ms)) if interval_ms >= 250 else max(10.0, float(hold_ms))
  cooldown_s = 0.065 if interval_ms >= 250 else 0.005

  with input_lock:
    _press_key_once(vk, scan, ext, is_up=False)
    time.sleep(effective_hold_ms / 1000.0)
    _press_key_once(vk, scan, ext, is_up=True)
    time.sleep(cooldown_s)

def _mouse_flag_pair(button):
  btn_map = {
    'left': (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
    'right': (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
    'middle': (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP)
  }
  return btn_map.get(button, btn_map['left'])

def _emit_mouse_flag(flag):
  inp = INPUT(type=INPUT_MOUSE, union=INPUT_UNION(mi=MOUSEINPUT(dx=0, dy=0, mouseData=0, dwFlags=flag, time=0, dwExtraInfo=0)))
  if user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT)) == 0:
    user32.mouse_event(flag, 0, 0, 0, 0)

def send_mouse_hw(button='left', click_type='single', hold_ms=25, pos_mode='current', x=0, y=0):
  if pos_mode == 'fixed': user32.SetCursorPos(int(x), int(y))
  down_flag, up_flag = _mouse_flag_pair(button)
  repeats = 2 if click_type == 'double' else 1

  for i in range(repeats):
    with input_lock:
      _emit_mouse_flag(down_flag)
      time.sleep(max(0.015, hold_ms / 1000.0))
      _emit_mouse_flag(up_flag)
    if repeats == 2 and i == 0: time.sleep(0.04)

class KeySlotWorker:
  def __init__(self, slot_id, cfg, on_change):
    self.slot_id = slot_id
    self.cfg = cfg
    self.on_change = on_change
    self.running = False
    self.thread = None
    self.count = 0
    self.phase = 'waiting'
    self.next_target = 0.0
    self.current_wait_ms = max(1, float(cfg.get('intervalMs', 100)))

  def start(self):
    self.running = True
    self.count = 0
    self.phase = 'waiting'
    self.next_target = time.perf_counter()
    self.thread = threading.Thread(target=self._loop, daemon=True)
    self.thread.start()

  def stop(self):
    self.running = False
    if self.thread and self.thread.is_alive(): self.thread.join(timeout=0.3)

  def _loop(self):
    action_mode = self.cfg.get('actionMode', 'tap')
    base_ms = max(1, float(self.cfg.get('intervalMs', 100)))
    hold_dur_ms = max(50, float(self.cfg.get('holdDurationMs', 1000)))
    jitter_ms = max(0, float(self.cfg.get('jitterMs', 0)))
    repeat_mode = self.cfg.get('repeatMode', 'infinite')
    max_count = int(self.cfg.get('repeatCount', 1))
    hold_ms = max(5, float(self.cfg.get('holdMs', 75)))
    vk = int(self.cfg.get('vk', 0x20))
    scan = user32.MapVirtualKeyW(vk, MAPVK_VK_TO_VSC)
    ext = KEYEVENTF_EXTENDEDKEY if vk in EXTENDED_VKS else 0
    self.next_target = time.perf_counter()

    if action_mode == 'hold_cycle':
      while self.running:
        is_down = False
        try:
          self.phase = 'holding'
          self.current_wait_ms = hold_dur_ms
          self.next_target = time.perf_counter() + (hold_dur_ms / 1000.0)
          with input_lock:
            _press_key_once(vk, scan, ext, is_up=False)
            time.sleep(0.015)
          is_down = True

          while self.running and time.perf_counter() < self.next_target:
            rem = self.next_target - time.perf_counter()
            if rem > 0.002: time.sleep(min(0.02, rem * 0.8))

          with input_lock:
            _press_key_once(vk, scan, ext, is_up=True)
            time.sleep(0.03)
          is_down = False
        finally:
          if is_down:
            with input_lock: _press_key_once(vk, scan, ext, is_up=True)

        if not self.running: break
        self.count += 1
        self.on_change('tick', self.slot_id, self.count)

        if repeat_mode == 'count' and self.count >= max_count:
          self.running = False
          self.on_change('done', self.slot_id, self.count)
          break

        self.phase = 'waiting'
        extra = random.uniform(0, jitter_ms) if jitter_ms > 0 else 0
        self.current_wait_ms = max(1.0, base_ms + extra)
        self.next_target = time.perf_counter() + (self.current_wait_ms / 1000.0)
        while self.running and time.perf_counter() < self.next_target:
          rem = self.next_target - time.perf_counter()
          if rem > 0.002: time.sleep(min(0.02, rem * 0.8))
      return

    while self.running:
      self.phase = 'waiting'
      extra = random.uniform(0, jitter_ms) if jitter_ms > 0 else 0
      self.current_wait_ms = max(1.0, base_ms + extra)
      wait_s = self.current_wait_ms / 1000.0
      self.next_target += wait_s

      while self.running and time.perf_counter() < self.next_target:
        rem = self.next_target - time.perf_counter()
        if rem > 0.002: time.sleep(min(0.02, rem * 0.8))

      if not self.running: break
      send_key_hw(vk, hold_ms, base_ms)
      self.count += 1
      self.on_change('tick', self.slot_id, self.count)

      if repeat_mode == 'count' and self.count >= max_count:
        self.running = False
        self.on_change('done', self.slot_id, self.count)
        break

class MultiKeyManager:
  def __init__(self):
    self.slots = {}
    self.total_count = 0
    self.started_at = None

  def _notify(self, ev_type, slot_id, slot_count):
    if ev_type == 'tick':
      self.total_count += 1
      emit({ 'event': 'tick', 'mode': 'key', 'slotId': slot_id, 'slotCount': slot_count, 'count': self.total_count })
    elif ev_type == 'done':
      self.emit_status()

  def emit_status(self):
    active_ids = [sid for sid, w in self.slots.items() if w.running]
    if not active_ids: self.started_at = None
    emit({ 'event': 'status', 'mode': 'key', 'running': len(active_ids) > 0, 'activeIds': active_ids, 'count': self.total_count })

  def start_many(self, items):
    self.stop_all(silent=True)
    self.total_count = 0
    self.started_at = time.perf_counter() if items else None
    for item in items:
      sid = str(item.get('id'))
      w = KeySlotWorker(sid, item, self._notify)
      self.slots[sid] = w
      w.start()
    self.emit_status()

  def toggle_slot(self, item):
    sid = str(item.get('id'))
    if sid in self.slots and self.slots[sid].running:
      self.slots[sid].stop()
      del self.slots[sid]
    else:
      if not self.started_at: self.started_at = time.perf_counter()
      w = KeySlotWorker(sid, item, self._notify)
      self.slots[sid] = w
      w.start()
    self.emit_status()

  def stop_all(self, silent=False):
    for w in list(self.slots.values()): w.stop()
    self.slots.clear()
    self.started_at = None
    if not silent: self.emit_status()

class MouseWorker:
  def __init__(self):
    self.running = False
    self.paused = False
    self.phase = 'waiting'
    self.thread = None
    self.count = 0
    self.cfg = {}
    self.next_target = 0.0
    self.current_wait_ms = 100.0
    self.started_at = None

  def start(self, cfg):
    self.stop()
    self.cfg = cfg
    self.running = True
    self.paused = False
    self.phase = 'waiting'
    self.count = 0
    self.started_at = time.perf_counter()
    self.thread = threading.Thread(target=self._loop, args=(cfg,), daemon=True)
    self.thread.start()
    emit({ 'event': 'status', 'mode': 'mouse', 'running': True, 'count': 0 })

  def stop(self):
    if self.running:
      self.running = False
      self.paused = False
      self.started_at = None
      if self.thread and self.thread.is_alive(): self.thread.join(timeout=0.3)
      emit({ 'event': 'status', 'mode': 'mouse', 'running': False, 'count': self.count })

  def _loop(self, cfg):
    click_type = cfg.get('clickType', 'single')
    button = cfg.get('button', 'left')
    pos_mode = cfg.get('posMode', 'current')
    tx, ty = int(cfg.get('x', 0)), int(cfg.get('y', 0))
    base_ms = max(1, float(cfg.get('intervalMs', 100)))
    hold_dur_ms = max(50, float(cfg.get('holdDurationMs', 1000)))
    jitter_ms = max(0, float(self.cfg.get('jitterMs', 0)))
    repeat_mode = cfg.get('repeatMode', 'infinite')
    max_count = int(cfg.get('repeatCount', 1))
    hold_ms = max(5, float(cfg.get('holdMs', 25)))
    down_flag, up_flag = _mouse_flag_pair(button)
    self.next_target = time.perf_counter()

    if click_type == 'hold_cycle':
      while self.running:
        if is_cursor_over_app():
          self.paused = True
          self.next_target = time.perf_counter()
          time.sleep(0.03)
          continue

        self.paused = False
        is_down = False
        try:
          self.phase = 'holding'
          self.current_wait_ms = hold_dur_ms
          self.next_target = time.perf_counter() + (hold_dur_ms / 1000.0)
          if pos_mode == 'fixed': user32.SetCursorPos(tx, ty)
          with input_lock:
            _emit_mouse_flag(down_flag)
            time.sleep(0.015)
          is_down = True

          while self.running and time.perf_counter() < self.next_target:
            if is_cursor_over_app():
              self.paused = True
              break
            rem = self.next_target - time.perf_counter()
            if rem > 0.002: time.sleep(min(0.02, rem * 0.8))

          with input_lock:
            _emit_mouse_flag(up_flag)
            time.sleep(0.02)
          is_down = False
        finally:
          if is_down:
            with input_lock: _emit_mouse_flag(up_flag)

        if not self.running: break
        if self.paused: continue

        self.count += 1
        emit({ 'event': 'tick', 'mode': 'mouse', 'count': self.count })

        if repeat_mode == 'count' and self.count >= max_count:
          self.running = False
          self.started_at = None
          emit({ 'event': 'status', 'mode': 'mouse', 'running': False, 'count': self.count })
          break

        self.phase = 'waiting'
        extra = random.uniform(0, jitter_ms) if jitter_ms > 0 else 0
        self.current_wait_ms = max(1.0, base_ms + extra)
        self.next_target = time.perf_counter() + (self.current_wait_ms / 1000.0)
        while self.running and time.perf_counter() < self.next_target:
          if is_cursor_over_app():
            self.paused = True
            break
          rem = self.next_target - time.perf_counter()
          if rem > 0.002: time.sleep(min(0.02, rem * 0.8))
      return

    while self.running:
      if is_cursor_over_app():
        self.paused = True
        self.next_target = time.perf_counter()
        time.sleep(0.03)
        continue

      self.paused = False
      self.phase = 'waiting'
      send_mouse_hw(button, click_type, hold_ms, pos_mode, tx, ty)
      self.count += 1
      emit({ 'event': 'tick', 'mode': 'mouse', 'count': self.count })

      if repeat_mode == 'count' and self.count >= max_count:
        self.running = False
        self.started_at = None
        emit({ 'event': 'status', 'mode': 'mouse', 'running': False, 'count': self.count })
        break

      extra = random.uniform(0, jitter_ms) if jitter_ms > 0 else 0
      self.current_wait_ms = max(1.0, base_ms + extra)
      wait_s = self.current_wait_ms / 1000.0
      self.next_target = time.perf_counter() + wait_s
      while self.running and time.perf_counter() < self.next_target:
        if is_cursor_over_app():
          self.paused = True
          break
        rem = self.next_target - time.perf_counter()
        if rem > 0.002: time.sleep(min(0.02, rem * 0.8))

key_mgr = MultiKeyManager()
mouse_worker = MouseWorker()

def telemetry_broadcaster():
  was_active = False
  while True:
    now = time.perf_counter()
    active_keys = []
    for sid, w in list(key_mgr.slots.items()):
      if w.running:
        rem_ms = max(0, int((w.next_target - now) * 1000))
        rep_mode = w.cfg.get('repeatMode', 'infinite')
        rep_max = int(w.cfg.get('repeatCount', 1))
        active_keys.append({
          'id': sid,
          'label': w.cfg.get('label', 'Tecla'),
          'actionMode': w.cfg.get('actionMode', 'tap'),
          'phase': w.phase,
          'remainingMs': rem_ms,
          'intervalMs': int(w.current_wait_ms),
          'count': w.count,
          'repeatMode': rep_mode,
          'repeatCount': rep_max,
          'leftCount': max(0, rep_max - w.count) if rep_mode == 'count' else None
        })

    mouse_info = None
    if mouse_worker.running:
      rem_ms = max(0, int((mouse_worker.next_target - now) * 1000))
      rep_mode = mouse_worker.cfg.get('repeatMode', 'infinite')
      rep_max = int(mouse_worker.cfg.get('repeatCount', 1))
      mouse_info = {
        'button': mouse_worker.cfg.get('button', 'left'),
        'clickType': mouse_worker.cfg.get('clickType', 'single'),
        'phase': mouse_worker.phase,
        'paused': mouse_worker.paused,
        'remainingMs': rem_ms,
        'intervalMs': int(mouse_worker.current_wait_ms),
        'count': mouse_worker.count,
        'repeatMode': rep_mode,
        'repeatCount': rep_max,
        'leftCount': max(0, rep_max - mouse_worker.count) if rep_mode == 'count' else None
      }

    starts = [t for t in [key_mgr.started_at, mouse_worker.started_at] if t is not None]
    uptime_ms = int((now - min(starts)) * 1000) if starts else 0
    is_active = len(active_keys) > 0 or mouse_info is not None

    if is_active or was_active:
      emit({ 'event': 'telemetry', 'active': is_active, 'uptimeMs': uptime_ms, 'keys': active_keys, 'mouse': mouse_info })
      was_active = is_active

    time.sleep(0.08)

def main():
  global safe_rects
  t_thread = threading.Thread(target=telemetry_broadcaster, daemon=True)
  t_thread.start()
  emit({ 'event': 'ready' })
  for line in sys.stdin:
    line = line.lstrip('\ufeff').strip()
    if not line: continue
    try:
      msg = json.loads(line)
      cmd = msg.get('cmd')
      if cmd == 'start_key': key_mgr.start_many(msg.get('items', []))
      elif cmd == 'toggle_key_slot': key_mgr.toggle_slot(msg.get('item', {}))
      elif cmd == 'stop_key': key_mgr.stop_all()
      elif cmd == 'start_mouse': mouse_worker.start(msg.get('config', {}))
      elif cmd == 'stop_mouse': mouse_worker.stop()
      elif cmd == 'set_safe_rects': safe_rects = msg.get('rects', [])
      elif cmd == 'stop_all':
        key_mgr.stop_all()
        mouse_worker.stop()
      elif cmd == 'get_cursor':
        pos = get_cursor_pos()
        emit({ 'event': 'cursor', 'x': pos['x'], 'y': pos['y'] })
    except Exception as e:
      emit({ 'event': 'error', 'message': str(e) })

if __name__ == '__main__':
  main()
