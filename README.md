# Naive realization event sourcing && cqrs :)

### Prerequisites
- docker
- docker-compose

### Build
```
docker-compose up
```

### Test
```
curl localhost:3000/item -d '{"id":1, "plan":100, "fact":200, "name": "name1", "comment": "comment1"}' -H 'Content-type: application/json'
curl localhost:3000/item -d '{"id":2, "plan":200, "fact":300, "name": "name2", "comment": "comment2"}' -H 'Content-type: application/json'

curl localhost:3000/correction -d '{ "id": 1, "changes": [{ "id": 1, "prop": "plan", "newValue": 50 }] }' -H 'Content-type: application/json'
curl -XPUT localhost:3000/correction -d '{"id": 1, "status": "approved"}'  -H 'Content-type: application/json'

curl localhost:3000/correction -d '{ "id": 2, "changes": [{ "id": 1, "prop": "plan", "newValue": 150 }, { "id": 1, "prop": "fact", "newValue": 350 } ] }' -H 'Content-type: application/json'
curl -XPUT localhost:3000/correction -d '{"id": 2, "status": "approved"}'  -H 'Content-type: application/json'

curl localhost:3000/correction -d '{ "id": 3, "changes": [{ "id": 1, "prop": "plan", "newValue": 550 }] }' -H 'Content-type: application/json'
curl localhost:3000/correction -d '{ "id": 4, "changes": [{ "id": 1, "prop": "plan", "newValue": 650 }] }' -H 'Content-type: application/json'
curl -XPUT localhost:3000/correction -d '{"id": 4, "status": "approved"}'  -H 'Content-type: application/json' 
curl -XPUT localhost:3000/correction -d '{"id": 3, "status": "approved"}'  -H 'Content-type: application/json'

curl localhost:3000/correction -d '{ "id": 5, "changes": [{ "id": 1, "prop": "plan", "newValue": 450 }, { "id": 2, "prop": "plan", "newValue": 300 } ] }' -H 'Content-type: application/json'
curl -XPUT localhost:3000/correction -d '{"id": 5, "status": "approved"}'  -H 'Content-type: application/json'
```
