cmake_minimum_required(VERSION 3.16)
project(pulsync_backend CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)

find_package(Boost 1.70.0 REQUIRED COMPONENTS system)

add_executable(pulsync_backend
    src/main.cpp
)

target_include_directories(pulsync_backend PRIVATE
    ${Boost_INCLUDE_DIRS}
    include
)

target_link_libraries(pulsync_backend PRIVATE
    Boost::system
    Threads::Threads
)

if(WIN32)
    target_link_libraries(pulsync_backend PRIVATE ws2_32 wsock32)
endif()
