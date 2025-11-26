"""
Python Worker 示例

连接到任务派发系统，接收并处理任务

安装依赖: pip install websocket-client
运行: python worker-python.py
"""

import json
import time
import threading
import websocket
from datetime import datetime

# 配置
CONFIG = {
    'server_url': 'ws://localhost:3000/ws',
    'group': 'default',           # Worker 分组
    'reconnect_interval': 5,      # 重连间隔（秒）
    'heartbeat_interval': 30,     # 心跳间隔（秒）
}


class Worker:
    def __init__(self, config):
        self.config = config
        self.ws = None
        self.worker_id = None
        self.is_connected = False
        self.heartbeat_thread = None
        self.should_stop = False

    def connect(self):
        """连接到服务器"""
        url = f"{self.config['server_url']}?group={self.config['group']}"
        print(f"[Worker] 正在连接到 {url}...")

        self.ws = websocket.WebSocketApp(
            url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )

        # 运行 WebSocket（阻塞）
        while not self.should_stop:
            try:
                self.ws.run_forever()
            except Exception as e:
                print(f"[Worker] 连接异常: {e}")
            
            if not self.should_stop:
                print(f"[Worker] {self.config['reconnect_interval']}秒后重连...")
                time.sleep(self.config['reconnect_interval'])

    def on_open(self, ws):
        """连接成功"""
        print("[Worker] WebSocket 连接成功")
        self.is_connected = True
        self.start_heartbeat()

    def on_message(self, ws, data):
        """收到消息"""
        try:
            message = json.loads(data)
            msg_type = message.get('type')
            print(f"[Worker] 收到消息: {msg_type}")

            if msg_type == 'connected':
                self.worker_id = message.get('workerId')
                print(f"[Worker] 已分配 Worker ID: {self.worker_id}")
                self.send_ready()

            elif msg_type == 'task':
                self.handle_task(message)

            elif msg_type == 'pong':
                pass  # 心跳响应

        except Exception as e:
            print(f"[Worker] 解析消息失败: {e}")

    def on_error(self, ws, error):
        """连接错误"""
        print(f"[Worker] WebSocket 错误: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """连接关闭"""
        print(f"[Worker] WebSocket 连接关闭")
        self.is_connected = False
        self.stop_heartbeat()

    def handle_task(self, message):
        """处理任务"""
        task_id = message.get('taskId')
        payload = message.get('payload')
        
        print(f"[Worker] 收到任务: {task_id}")
        print(f"[Worker] 任务数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")

        start_time = time.time()

        try:
            # ========== 在这里实现你的任务处理逻辑 ==========
            result = self.process_task(payload)
            # ================================================

            duration = int((time.time() - start_time) * 1000)
            print(f"[Worker] 任务完成: {task_id}, 耗时: {duration}ms")

            self.send_task_complete(task_id, result, duration)

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            print(f"[Worker] 任务失败: {task_id}, 错误: {e}")

            self.send_task_error(task_id, str(e), duration)

    def process_task(self, payload):
        """
        ========== 实现你的任务处理逻辑 ==========
        
        payload 结构:
        {
            "model": "default",
            "messages": [...],  # 可选
            "data": {...}       # 任务数据
        }
        """
        print("[Worker] 正在处理任务...")
        
        # 获取任务数据
        data = payload.get('data', {})
        model = payload.get('model', 'default')
        
        # 示例：模拟处理延迟
        time.sleep(2)

        # 返回处理结果
        return {
            'success': True,
            'message': '任务处理完成',
            'processed_data': data,
            'timestamp': datetime.now().isoformat(),
        }

    def send_ready(self):
        """发送 ready 消息"""
        self.send({'type': 'ready'})
        print("[Worker] 已发送 ready 消息，等待任务...")

    def send_task_complete(self, task_id, result, duration):
        """发送任务完成消息"""
        self.send({
            'type': 'task_complete',
            'taskId': task_id,
            'result': result,
            'duration': duration,
        })

    def send_task_error(self, task_id, error, duration):
        """发送任务失败消息"""
        self.send({
            'type': 'task_error',
            'taskId': task_id,
            'error': error,
            'duration': duration,
        })

    def send(self, message):
        """发送消息"""
        if self.ws and self.is_connected:
            self.ws.send(json.dumps(message))
        else:
            print("[Worker] WebSocket 未连接，无法发送消息")

    def start_heartbeat(self):
        """启动心跳"""
        def heartbeat_loop():
            while self.is_connected and not self.should_stop:
                time.sleep(self.config['heartbeat_interval'])
                if self.is_connected:
                    self.send({'type': 'ping'})

        self.heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        self.heartbeat_thread.start()

    def stop_heartbeat(self):
        """停止心跳"""
        pass  # 线程会自动停止

    def disconnect(self):
        """断开连接"""
        self.should_stop = True
        if self.ws:
            self.ws.close()


def main():
    worker = Worker(CONFIG)
    
    try:
        worker.connect()
    except KeyboardInterrupt:
        print("\n[Worker] 正在关闭...")
        worker.disconnect()


if __name__ == '__main__':
    main()
