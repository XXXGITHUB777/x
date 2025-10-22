import requests
import yaml

# 从GitHub获取SiHai.yaml内容
url = "https://raw.githubusercontent.com/ppmm52111/QX/main/SiHai.yaml"
response = requests.get(url)

# 如果请求成功
if response.status_code == 200:
    yaml_content = yaml.safe_load(response.text)

    # 转换为 QX 格式的节点
    qx_config = []
    for item in yaml_content.get('proxies', []):
        qx_node = {
            "name": item.get("name", "default_name"),
            "type": "http",
            "server": item.get("server", ""),
            "port": item.get("port", 1080),
            "username": item.get("username", ""),
            "password": item.get("password", ""),
        }
        qx_config.append(qx_node)

    # 将转换后的配置保存为 QX 格式
    with open("qx_config.txt", "w") as f:
        for node in qx_config:
            f.write(f"NAME={node['name']}, TYPE={node['type']}, SERVER={node['server']}, PORT={node['port']}\n")
else:
    print("Failed to fetch SiHai.yaml")
