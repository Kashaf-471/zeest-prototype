from speech import model, CACHE, MODEL

if __name__ == "__main__":
    model(download=True)
    print(f"Local model {MODEL} cached at {CACHE}")
