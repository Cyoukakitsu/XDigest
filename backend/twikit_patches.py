"""
Monkey-patches for twikit 2.3.x compatibility with X's current API.

Two known breakages as of 2026-05:
1. ClientTransaction.init raises "Couldn't get KEY_BYTE indices" because X
   changed the JS bundle format that twikit parses for transaction headers.
2. User.__init__ raises KeyError on 'withheld_in_countries' and
   entities.description.urls for users that omit these optional fields.
"""
import bs4
from twikit.x_client_transaction import ClientTransaction
from twikit.user import User


# --- Patch 1: skip transaction ID generation when X's JS can't be parsed ---

_original_ct_init = ClientTransaction.init


async def _patched_ct_init(self, session, headers):
    try:
        await _original_ct_init(self, session, headers)
    except Exception:
        self.home_page_response = bs4.BeautifulSoup('', 'html.parser')
        self.DEFAULT_ROW_INDEX = 0
        self.DEFAULT_KEY_BYTES_INDICES = [1, 2, 3]
        self.key = None
        self.key_bytes = []
        self.animation_key = ''


_original_ct_generate = ClientTransaction.generate_transaction_id


def _patched_ct_generate(self, method, path, **kwargs):
    try:
        return _original_ct_generate(self, method, path, **kwargs)
    except Exception:
        return ''


ClientTransaction.init = _patched_ct_init
ClientTransaction.generate_transaction_id = _patched_ct_generate


# --- Patch 2: tolerate missing optional fields in User API responses ---

_original_user_init = User.__init__


def _patched_user_init(self, client, data):
    legacy = data.get('legacy', data)
    entities = legacy.get('entities', {})
    description = entities.get('description', {})
    if 'urls' not in description:
        description['urls'] = []
    if 'urls' not in entities:
        pass
    entities['description'] = description
    legacy['entities'] = entities
    if 'withheld_in_countries' not in legacy:
        legacy['withheld_in_countries'] = []
    _original_user_init(self, client, data)


User.__init__ = _patched_user_init
