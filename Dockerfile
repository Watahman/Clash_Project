FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml ./
RUN mvn -B -q -DskipTests dependency:go-offline

COPY src/Java ./src/Java
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

RUN groupadd --system clashpanel \
    && useradd --system --gid clashpanel --home-dir /app clashpanel \
    && mkdir -p /tmp/clashpanel-cache \
    && chown -R clashpanel:clashpanel /app /tmp/clashpanel-cache

COPY --from=build --chown=clashpanel:clashpanel /app/target/clashpanel-1.0.0.jar /app/app.jar

USER clashpanel

ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -XX:MaxRAMPercentage=75 -Djava.io.tmpdir=/tmp"
ENV CACHE_DB_PATH="/tmp/clashpanel-cache/clashtools-cache.db"

EXPOSE 8080

CMD ["java", "-jar", "/app/app.jar"]
