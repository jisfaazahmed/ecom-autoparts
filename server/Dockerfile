FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm ci --include=prod

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]