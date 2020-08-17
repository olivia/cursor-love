// client-side js, loaded by index.html
// run by the browser each time the page is loaded

function makeSendListen(peerCon) {
  const p = peerCon.peer;
  return {
    id: p,
    send: (data) => peerCon.send(data),
    listen: (sendCb, closeCb) => {
      peerCon.on("data", (data) => sendCb(p, data));
      peerCon.on("close", () => closeCb(p));
    },
  };
}

async function connect(onMessage, onDisconnect) {
  let allPeers = {};
  const onNewConnection = (peerCon) => {
    const { id, send, listen } = makeSendListen(peerCon);
    allPeers[id] = send;
    listen(onMessage, () => {
      onDisconnect(id);
      delete allPeers[id];
    });
  };

  return new Promise(async (res, rej) => {
    const sendMessage = (data) => {
      Object.values(allPeers).forEach((fn) => fn(data));
    };
    try {
      const fetchCall = await fetch("/p/cl/peerjs/peers");
      const peerList = await fetchCall.json();
      const peer = new Peer(undefined, {
        host: window.location.host,
        port: 443,
        secure: true,
        path: "/p/cl",
      });

      peer.on("open", function(id) {
        console.log("My peer ID is: " + id);
        console.log(`Peer List is: ${peerList}`);
        const peers = peerList.filter((p) => p !== id);
        peer.on("connection", onNewConnection);
        Promise.all(
          peers.map((p) => {
            return new Promise((res) => {
              const peerCon = peer.connect(p);
              peerCon.on("open", () => {
                res(onNewConnection(peerCon));
              });
            });
          })
        );
      });

      res(sendMessage);
    } catch (e) {
      rej(e);
    }
  });
}

async function init() {
  let cursor = {};
  const receiveMessage = (id, { x, y }) => {
    if (!(id in cursor)) {
      const newDiv = document.createElement("div");
      newDiv.className = "cursor";
      document.body.appendChild(newDiv);
      cursor[id] = newDiv;
    }
    const cursorDiv = cursor[id];
    cursorDiv.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const sendMessage = await connect(
    (id, msg) => receiveMessage(id, msg),
    (id) => {
      cursor[id].remove();
      delete cursor[id];
    }
  );
  document.body.onmousemove = (evt) => {
    sendMessage({ x: evt.clientX, y: evt.clientY });
  };
}

init();
