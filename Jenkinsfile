pipeline {
    agent any

    parameters {
        string(name: 'IMAGE_NAME', defaultValue: 'blog-app-backend', description: 'Docker Image Name')
        string(name: 'CONTAINER_NAME', defaultValue: 'blog-app-backend-container', description: 'Docker Container Name')
        string(name: 'APP_PORT', defaultValue: '5000', description: 'Application Port')

        string(name: 'GIT_REPO_URL', defaultValue: 'git@github.com:Yashodip1602/blog-app-backend.git', description: 'Git Repository')
        string(name: 'GIT_BRANCH', defaultValue: 'development', description: 'Git Branch')

        string(name: 'SONAR_PROJECT_KEY', defaultValue: 'blog-app-dev', description: 'Sonar Project Key')
        string(name: 'SONAR_PROJECT_NAME', defaultValue: 'blog-app-dev', description: 'Sonar Project Name')
    }

    options {
        timestamps()
        ansiColor('xterm')
        disableConcurrentBuilds()
        timeout(time: 90, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        skipDefaultCheckout(true)
    }

    environment {

        IMAGE_NAME = "${params.IMAGE_NAME}"
        CONTAINER_NAME = "${params.CONTAINER_NAME}"
        APP_PORT = "${params.APP_PORT}"

        GIT_REPO_URL = "${params.GIT_REPO_URL}"
        GIT_BRANCH = "${params.GIT_BRANCH}"

        SONAR_PROJECT_KEY = "${params.SONAR_PROJECT_KEY}"
        SONAR_PROJECT_NAME = "${params.SONAR_PROJECT_NAME}"

        GITHUB_SSH_CREDENTIALS_ID = "github-ssh-key"
        SONAR_TOKEN_CREDENTIALS_ID = "sonarqube-token"

        ENV_FILE_PATH = "/home/ubuntu/.env"

        DOCKER_BUILDKIT = "1"
    }

    stages {

        stage('Checkout Source Code') {
            steps {
                sshagent([env.GITHUB_SSH_CREDENTIALS_ID]) {
                    git branch: env.GIT_BRANCH,
                        url: env.GIT_REPO_URL
                }
            }
        }

        stage('Collect Git Info') {
            steps {
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short=12 HEAD",
                        returnStdout: true
                    ).trim()

                    echo "Git Commit : ${env.GIT_COMMIT_SHORT}"
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e
                    npm ci --no-audit --no-fund
                '''
            }
        }

        stage('SonarQube Scan') {
            steps {
                withCredentials([
                    string(credentialsId: env.SONAR_TOKEN_CREDENTIALS_ID,
                    variable: 'SONAR_TOKEN')
                ]) {

                    withSonarQubeEnv('SonarQube') {

                        sh '''
                            sonar-scanner \
                              -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                              -Dsonar.projectName=${SONAR_PROJECT_NAME} \
                              -Dsonar.sources=src \
                              -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/** \
                              -Dsonar.token=$SONAR_TOKEN
                        '''
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {

                sh '''
                    set -e

                    docker build \
                        -t ${IMAGE_NAME}:${BUILD_NUMBER} \
                        -t ${IMAGE_NAME}:${GIT_COMMIT_SHORT} \
                        -t ${IMAGE_NAME}:latest \
                        .
                '''
            }
        }

        stage('Trivy Image Scan') {
            steps {

                sh '''
                    set +e

                    mkdir -p trivy-report

                    trivy image \
                        --severity HIGH,CRITICAL \
                        --ignore-unfixed \
                        --format table \
                        --output trivy-report/report.txt \
                        ${IMAGE_NAME}:latest

                    cat trivy-report/report.txt

                    set -e
                '''
            }
        }

        stage('Deploy Container') {

            steps {

                sh '''
                    set -e

                    if [ ! -f "${ENV_FILE_PATH}" ]; then
                        echo ".env file not found"
                        exit 1
                    fi

                    docker stop ${CONTAINER_NAME} || true
                    docker rm ${CONTAINER_NAME} || true

                    docker run -d \
                        --name ${CONTAINER_NAME} \
                        --restart unless-stopped \
                        --env-file ${ENV_FILE_PATH} \
                        -p ${APP_PORT}:${APP_PORT} \
                        ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Verify Deployment') {

            steps {

                sh '''
                    docker ps

                    docker ps | grep ${CONTAINER_NAME}

                    docker logs --tail=50 ${CONTAINER_NAME}
                '''
            }
        }

    stage('Cleanup Old Docker Images') {
            steps {

                sh '''
                    docker image prune -f
                '''
            }
        }
    }

    post {

        success {

            echo "Deployment Successful."
        }

        failure {

            echo "Pipeline Failed."
        }

        always {

            archiveArtifacts artifacts: 'trivy-report/report.txt', allowEmptyArchive: true

            cleanWs()
        }
    }
}