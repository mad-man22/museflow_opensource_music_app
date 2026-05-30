import socket

def check_port(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    try:
        s.connect(("127.0.0.1", port))
        print(f"Port {port} is OPEN (a process is listening!)")
        s.close()
    except Exception as e:
        print(f"Port {port} is CLOSED ({e})")

if __name__ == "__main__":
    check_port(8000)
    check_port(3000)
    check_port(3001)
