import requests
from requests.auth import HTTPBasicAuth

class NetworkHelper:
    def __init__(self, base_url='http://localhost:9000/api', username=None, password=None):
        """
        base_url: base API URL (default points to localhost:9000/api)
        username/password: optional for HTTP Basic Auth
        """
        self.base_url = base_url.rstrip("/")
        self.auth = HTTPBasicAuth(username, password) if username and password else None

    def _build_url(self, endpoint, item_id=None):
        if item_id is None:
            return f"{self.base_url}/{endpoint}/"
        return f"{self.base_url}/{endpoint}/{item_id}/"

    def get_list(self, endpoint):
        url = self._build_url(endpoint)
        resp = requests.get(url, auth=self.auth)
        try:
            return resp.status_code, resp.json()
        except ValueError:
            return resp.status_code, {}

    def get_item(self, endpoint, item_id):
        url = self._build_url(endpoint, item_id)
        resp = requests.get(url, auth=self.auth)
        try:
            return resp.status_code, resp.json()
        except ValueError:
            return resp.status_code, {}

    def create_item(self, endpoint, data=None):
        url = self._build_url(endpoint)
        resp = requests.post(url, json=data, auth=self.auth)
        try:
            return resp.status_code, resp.json()
        except ValueError:
            return resp.status_code, {}

    def update_item(self, endpoint, item_id, data=None):
        url = self._build_url(endpoint, item_id)
        resp = requests.put(url, json=data, auth=self.auth)
        try:
            return resp.status_code, resp.json()
        except ValueError:
            return resp.status_code, {}

    def delete_item(self, endpoint, item_id):
        url = self._build_url(endpoint, item_id)
        resp = requests.delete(url, auth=self.auth)
        # Some APIs return 204 No Content for deletes; normalize to empty body
        if resp.status_code in (200, 204):
            return resp.status_code, {}
        try:
            return resp.status_code, resp.json()
        except ValueError:
            return resp.status_code, {}