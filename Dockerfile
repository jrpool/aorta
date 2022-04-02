# --------------------------------------------------------------------------
FROM node:12 as builder
# COPY package.json package.json
# COPY package-lock.json package-lock.json
# COPY .npmrc .npmrc

# Base directory (not in CVS template).
WORKDIR /apps/nodejs/gcp/

# Prevent using cache and thereby omitting new dependencies.
RUN npm cache clean
RUN npm install --production
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
ENV NO_UPDATE_NOTIFIER=true NODE_ENV=production PORT=9082 LOGCONSOLE=true CONFIGBASEPATH=/apps/nodejs/gcp/config/ CERTSBASEPATH=/apps/nodejs/gcp/nodecerts LOGBASEPATH=/apps/nodejs/gcp/log HOST=localhost HOSTPORT=3005 PROTOCOL=http SMTP_SERVER=paz1trendvip.caremarkrx.net SMTP_PORT=25 MAIL_SENDER=no-reply@cvshealth.com REPLY_TO=a11yautomation@AetnaO365.onmicrosoft.com EMAIL_LINK=https://dev.digital-services.cvshealth.com/aorta/actions

# Port the server will be listening to.
EXPOSE 9082

CMD ["index.js"]
