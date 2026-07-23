FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests clean package


FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/target/clashpanel-1.0.0.jar app.jar

ENV JAVA_TOOL_OPTIONS="-Xmx256m -XX:MaxMetaspaceSize=96m -XX:MaxDirectMemorySize=32m -XX:+UseSerialGC"

EXPOSE 10000

CMD ["java", "-jar", "app.jar"]