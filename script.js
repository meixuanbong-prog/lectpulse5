const API_URL = "https://script.google.com/macros/s/AKfycbxKCivEMslmoyI73YtY_onvUF0Uhmo_zSAHI4AijyOyj4h8MzFyrRkhgbgIVn6AJB3mjQ/exec";

let currentLecturer = {
    id: "",
    name: "",
    subject: "",
    phone: "",
    schedule: "",
    googleForm: ""
};

window.addEventListener("DOMContentLoaded", () => {
    fetchCurrentLecturer();
});

function fetchCurrentLecturer() {
    fetch(API_URL)
        .then(res => res.json())
        .then(res => {
            if (res.success && res.data) {
                currentLecturer = res.data;
                document.getElementById("lecturerName").innerText = currentLecturer.name;
                document.getElementById("lecturerSubject").innerText = "Subject: " + currentLecturer.subject;
                document.getElementById("lecturerSchedule").innerText = currentLecturer.schedule;

                // 更新照片渲染逻辑
                const photoImg = document.getElementById("lecturerPhoto");
                if (currentLecturer.photo) {
                    // 如果 Sheet 里填的是完整的网址则直接使用，否则匹配本地 images/ 文件夹下的图片
                    const photoSrc = currentLecturer.photo.startsWith("http") 
                        ? currentLecturer.photo 
                        : `./Gallery/${currentLecturer.photo}`;
                    
                    photoImg.src = photoSrc;
                    photoImg.style.display = "block";
                } else {
                    photoImg.style.display = "none";
                }
            } else {
                document.getElementById("lecturerName").innerText = "No active lecturer";
                document.getElementById("lecturerSubject").innerText = "Subject: -";
                document.getElementById("lecturerSchedule").innerText = "-";
                document.getElementById("lecturerPhoto").style.display = "none";
            }
        })
        .catch(err => console.error("Failed to load current lecturer:", err));
}

// 1. 获取或生成唯一的设备 ID（存放在手机浏览器本地存储中）
function getDeviceId() {
    let devId = localStorage.getItem("lectpulse_device_id");
    if (!devId) {
        devId = "DEV_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
        localStorage.setItem("lectpulse_device_id", devId);
    }
    return devId;
}

// 2. 独立签到提交主逻辑
async function submitAttendance() {
    let matric = document.getElementById("matricNumber").value.trim();
    let name = document.getElementById("studentName").value.trim();
    let studentClass = document.getElementById("studentClass").value.trim();

    if (matric === "" || name === "" || studentClass === "") {
        alert("Please fill in all required fields (Matric Number, Name, Class)!");
        return;
    }

    document.getElementById("attendanceStatus").innerHTML = "📍 Getting Location & Device Info...";

    // 获取外网 IP 地址
    let userIp = "UNKNOWN";
    try {
        let ipRes = await fetch("https://api.ipify.org?format=json");
        let ipData = await ipRes.json();
        userIp = ipData.ip;
    } catch (e) {
        console.warn("IP Fetch Failed:", e);
    }

    // 获取唯一设备识别码
    let deviceId = getDeviceId();

    // 获取 GPS 定位并提交数据
    navigator.geolocation.getCurrentPosition(
        (position) => {
            let payload = {
                action: "attendance",
                matricNumber: matric,
                fullName: name,
                studentClass: studentClass,
                subject: (typeof currentLecturer !== "undefined" && currentLecturer.subject) ? currentLecturer.subject : "General",
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                ipAddress: userIp,
                deviceId: deviceId
            };

            document.getElementById("attendanceStatus").innerHTML = "⏳ Submitting attendance...";

            fetch(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(result => {
                if (result.status === "SUCCESS") {
                    if (result.validation === "Success") {
                        document.getElementById("attendanceStatus").innerHTML = "✅ Attendance Success! (" + result.distance + "m)";
                    } else {
                        document.getElementById("attendanceStatus").innerHTML = "❌ Rejected: Out of classroom radius (" + result.distance + "m)";
                    }
                } else if (result.status === "DUPLICATE_DEVICE") {
                    // 代签拦截提示
                    document.getElementById("attendanceStatus").innerHTML = "❌ Rejected: Device already used by another student!";
                } else {
                    document.getElementById("attendanceStatus").innerHTML = "❌ Submission failed: " + (result.message || "Error");
                }
            })
            .catch(err => {
                document.getElementById("attendanceStatus").innerHTML = "❌ Network error, please try again.";
            });
        },
        () => {
            document.getElementById("attendanceStatus").innerHTML = "❌ Please enable GPS location access.";
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// 3. 独立 Request 留言提交逻辑（直接传输给后台，放弃 Google Form）
// 3. 独立 Request 纯匿名留言提交逻辑
function sendRequest() {
    let requestText = document.getElementById("lecturerRequest").value.trim();

    // 1. 只校验是否有输入提问内容
    if (requestText === "") {
        alert("Please enter your question or request first.");
        return;
    }

    document.getElementById("requestStatus").innerHTML = "⏳ Sending request...";

    // 2. 组装纯匿名数据 payload（不发送学号、姓名和班级）
    let payload = {
        action: "request",
        subject: (typeof currentLecturer !== "undefined" && currentLecturer.subject) ? currentLecturer.subject : "General",
        lecturerId: (typeof currentLecturer !== "undefined" && currentLecturer.id) ? currentLecturer.id : "",
        request: requestText
    };

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(result => {
        if (result.status === "SUCCESS") {
            document.getElementById("requestStatus").innerHTML = "✅ Request sent successfully!";
            document.getElementById("lecturerRequest").value = ""; // 成功后清空输入框
        } else {
            document.getElementById("requestStatus").innerHTML = "❌ Failed to send request: " + (result.message || "Error");
        }
    })
    .catch(err => {
        document.getElementById("requestStatus").innerHTML = "❌ Network error, please try again.";
    });
}

function openWhatsApp() {
    if (!currentLecturer.phone) {
        alert("Phone number not available.");
        return;
    }
    let message = encodeURIComponent("Hello " + currentLecturer.name + ", I would like to arrange a consultation.");
    window.open("https://wa.me/" + currentLecturer.phone + "?text=" + message, "_blank");
}

// 自定义班级下拉菜单交互
document.addEventListener("DOMContentLoaded", () => {
    const wrapper = document.querySelector(".custom-select-wrapper");
    const selectBox = document.getElementById("customSelect");
    const optionsList = document.querySelectorAll(".custom-option");
    const selectedText = document.getElementById("selectedText");
    const hiddenInput = document.getElementById("studentClass");

    if (selectBox) {
        // 点击展开/收起菜单
        selectBox.addEventListener("click", (e) => {
            e.stopPropagation();
            wrapper.classList.toggle("open");
        });

        // 选中某个选项
        optionsList.forEach(option => {
            option.addEventListener("click", (e) => {
                e.stopPropagation();
                if (option.classList.contains("disabled")) return;

                const val = option.getAttribute("data-value");
                const text = option.innerText;

                hiddenInput.value = val;
                selectedText.innerText = text;
                selectedText.classList.add("has-value");

                optionsList.forEach(opt => opt.classList.remove("selected"));
                option.classList.add("selected");

                wrapper.classList.remove("open");
            });
        });

        // 点击页面其他空白区域时自动关闭下拉框
        document.addEventListener("click", () => {
            wrapper.classList.remove("open");
        });
    }
});

