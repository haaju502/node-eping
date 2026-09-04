{
  "targets": [
    {
      "target_name": "eping",
      "sources": [ "<!(node src/index.js > /dev/null 2>&1 && echo src/stub.c)" ]
    }
  ]
}
