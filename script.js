let chatHistory = [];
let uuid = generateUUID();

function displayFiles(files) {
  if (files.length > 0) {
    var fileList = document.getElementById("fileList");
    fileList.innerHTML = "";
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var listItem = document.createElement("div");
      listItem.className = "file-item";
      var icon = document.createElement("img");
      icon.style.width = "24px";
      icon.style.height = "24px";
      if (file.name.endsWith(".pdf")) {
        icon.src = STATIC_URL + "assets/pdf.png";
      } else if (file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
        icon.src = STATIC_URL + "assets/doc.png";
      } else if (file.name.endsWith(".ppt") || file.name.endsWith(".pptx")) {
        icon.src = STATIC_URL + "assets/ppt.png";
      } else if (file.name.endsWith(".txt")) {
        icon.src = STATIC_URL + "assets/txt.png";
      }
      listItem.appendChild(icon);
      listItem.appendChild(document.createTextNode(" " + file.name));
      fileList.appendChild(listItem);
    }
    document.getElementById("note").style.display = "none";
    document.getElementById("selectedDocuments").style.display = "block";
    document.getElementById("uploadButton").style.display = "block";
  }
}

function uploadAndProcess() {
  document.getElementById("selectedDocuments").style.display = "none";
  document.getElementById("upload-container").style.display = "none";
  document.getElementById("loadingContainer").style.display = "flex";
  document.getElementById("uploadButton").style.display = "none";
  var input = document.getElementById("fileInput");
  var files = input.files;
  var formData = new FormData();

  for (var i = 0; i < input.files.length; i++) {
    formData.append("files", input.files[i]);
  }

  formData.append("userID", uuid);

  fetch("/process", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log(data);
      document.getElementById("loadingContainer").style.display = "none";
      let filenames = [];
      for (let i = 0; i < files.length; i++) {
        filenames.push(files[i].name);
      }
      document.getElementById("heading").style.display = "none";
      let heading = document.getElementById("para");
      heading.style.display = "block";
      if (files.length > 1) {
        heading.innerHTML = `<p><strong>Chatting with:</strong> ${filenames.join(
          ", "
        )}</p>`;
      } else {
        heading.innerHTML = `<p><strong>Chatting with :</strong> ${filenames[0]}</p>`;
      }
      document.getElementById("chatContainer").style.display = "block";
      var chatContainer = document.getElementById("chatContainer");
      chatContainer.style.display = "block";
    })
    .catch((error) => {
      console.error(
        "There has been a problem with your fetch operation:",
        error
      );
    });
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function sendMessage() {
  var chatInput = document.getElementById("chatInput");
  var query = chatInput.value;
  if (query.trim() != "") {
    var chatBox = document.getElementById("chatBox");
    var userMessage = document.createElement("div");
    userMessage.classList.add("message", "user");
    userMessage.innerHTML = `
        <div class="messageInside">
                <strong>User</strong>
                <div class="message-content">
                        ${chatInput.value}
                </div>
        </div>
        <img src="${STATIC_URL}assets/user.png" alt="User Avatar" class="avatar">`;
    chatBox.appendChild(userMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
    chatInput.value = "";
    var typingMessage = document.createElement("div");
    typingMessage.classList.add("message", "bot");
    typingMessage.innerHTML = `
    <img src="${STATIC_URL}assets/bot.png" alt="Bot Avatar" class="avatar">
    <div class="messageInside">
        <strong>Bot</strong>
        <div class="typing"></div>
    </div>`;
    chatBox.appendChild(typingMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
    var botResponse = {};
    const response = await fetch("/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
        history: chatHistory,
        userId: uuid,
      }),
    });

    botResponse = await response.json();
    chatHistory.push({ query: query, answer: botResponse.answer });
    console.log(chatHistory);

    chatBox.removeChild(typingMessage);

    var botMessage = document.createElement("div");
    botMessage.classList.add("message", "bot");
    botMessage.innerHTML = `
    <img src="${STATIC_URL}assets/bot.png" alt="Bot Avatar" class="avatar">
    <div class="messageInside">
        <strong>Bot</strong>
        <div class="message-content">
            ${botResponse.answer}<br><br>Reference Page Nos:<br>${botResponse.references}
        </div>
    </div>`;
    chatBox.appendChild(botMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

window.onload = function () {
  var chatInput = document.getElementById("chatInput");
  var sendBtn = document.getElementById("sendBtn");
  chatInput.addEventListener("input", function () {
    if (chatInput.value.trim() === "") {
      console.log("disable");
      sendBtn.disabled = true;
    } else {
      sendBtn.disabled = false;
    }
  });
  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
};
