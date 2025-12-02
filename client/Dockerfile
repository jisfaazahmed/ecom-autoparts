<<<<<<< HEAD
FROM node:22
=======
FROM node:18-alpine
>>>>>>> a7a841a (Add Docker configurations for client and server, and initialize MongoDB data directory.)

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

<<<<<<< HEAD
EXPOSE 3000
=======
EXPOSE 5173
>>>>>>> a7a841a (Add Docker configurations for client and server, and initialize MongoDB data directory.)

CMD ["npm", "run", "dev", "--", "--host"]