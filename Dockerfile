# --------------------------------------------------------------------------
FROM node:12 as builder
# COPY package.json package.json
# COPY package-lock.json package-lock.json
# COPY .npmrc .npmrc

RUN  npm install --production 
# --------------------------------------------------------------------------

FROM gcr.io/distroless/nodejs:16

USER 9000:9000

# Base directory.
WORKDIR /apps/nodejs/gcp/

# Home directory.
ENV HOME=/apps/nodejs/gcp/

# COPY --from=builder node_modules ./node_modules

# Copy the root directory to the home directory.
COPY . .

# Do not copy the certs and config folder in this image. They will be injected by Kubernetes.
# To run this image locally, mount the host nodecert and config folder to the Docker.
# docker run -p 9082:9082 --rm \
#--env "NO_UPDATE_NOTIFIER=true NODE_ENV=production PORT=9082 \
#LOGCONSOLE=true CONFIGBASEPATH=/apps/nodejs/gcp/config/ CERTSBASEPATH=/apps/nodejs/gcp/nodecerts" \
#-v /apps/nodejs/gcp/nodecerts:/apps/nodejs/gcp/nodecerts \
#-v /apps/nodejs/gcp/config/:/apps/nodejs/gcp/config/ <image name>

# To go inside the running container:
# docker container exec -it <container id> sh

# Building Docker:
# docker build -t <image name> .
# <image name> (all lowercase and if needed separated by hyphen, e.g. redis-service)

# If pipeline configs are not passed, then these are used
ENV NO_UPDATE_NOTIFIER=true NODE_ENV=production PORT=9082 LOGCONSOLE=true CONFIGBASEPATH=/apps/nodejs/gcp/config/ CERTSBASEPATH=/apps/nodejs/gcp/nodecerts LOGBASEPATH=/apps/nodejs/gcp/log PROTOCOL=http HOST=localhost HOSTPORT=3005 SMTP_SERVER=paz1trendvip.caremarkrx.net MAIL_SENDER=no-reply@cvshealth.com

# port the server will be listening to.
EXPOSE 9082

CMD ["index.js"]
