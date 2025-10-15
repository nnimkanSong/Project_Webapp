# ใช้ Node.js 20
FROM node:20

# กำหนด working directory
WORKDIR /usr/src/app

# ก็อปไฟล์ package.json และ package-lock.json ก่อน (เพื่อ cache npm install)
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install --production

# ก็อปซอร์สโค้ดทั้งหมดเข้า container
COPY . .

# ใช้ node ธรรมดาใน production (ไม่ใช่ nodemon)
CMD ["node", "index.js"]
