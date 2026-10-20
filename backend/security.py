import hashlib, hmac, secrets


def hash_password(value):
    salt = secrets.token_hex(16)
    return (
        salt
        + ":"
        + hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    )


def verify_password(value, stored):
    salt, digest = stored.split(":")
    return hmac.compare_digest(
        digest,
        hashlib.scrypt(value.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex(),
    )
